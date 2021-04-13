const AWS = require('aws-sdk') // eslint-disable-line node/no-unpublished-require
const s3 = new AWS.S3({ region: 'us-east-1', apiVersion: '2006-03-01' })
const path = require('path')

module.exports.getFromS3 = async (bucketName, objectPath) => {
  // The key for s3 documents does NOT include a root level slash at the beginning
  if (objectPath.startsWith('/')) {
    objectPath = objectPath.substring(1)
  }
  console.log('Fetch from s3:', bucketName + '/' + objectPath)
  return s3.getObject({
    Bucket: bucketName,
    Key: objectPath,
  }).promise()
}

const transclude = async (body, bucketName, parentDir) => {
  // Get the paths of files to include from strings like: <!--#include virtual="foo/bar.shtml" -->
  const includesRegex = /<!--\s?#include virtual="(.+?)"\s?-->/g
  const matches = Array.from(body.matchAll(includesRegex))

  // Fetch all included files
  const promises = matches.map((match) => exports.getFromS3(bucketName, path.normalize(path.join(parentDir, match[1]))))
  return Promise.all(promises).then(async (s3results) => {
    // Also need to transclude the included page if it is an shtml file
    const includedBodies = await s3results.map(async (response, index) => {
      const pageBody = response.Body.toString()
      const filepath = matches[index][1]
      console.log('retrieved', filepath)
      const pageDir = path.normalize(path.join(parentDir, path.dirname(filepath)))
      const resultBody = path.extname(filepath) === '.shtml' ? await transclude(pageBody, bucketName, pageDir) : pageBody
      return resultBody
    })
    return Promise.all(includedBodies).then(async (resolvedBodies) => {
      resolvedBodies.forEach(async (includedBody, index) => {
        body = body.replace(matches[index][0], includedBody)
      })
      return body
    })
  })
}

module.exports.handler = async (event, context, callback) => {
  const response = event.Records[0].cf.response
  const request = event.Records[0].cf.request
  const headers = request.headers
  const uri = request.uri

  if (uri === '/' || path.extname(uri) === '.shtml') {
    // Get the name of the origin bucket that was fetched from
    const bucketName = request.origin.s3.domainName.replace('.s3.amazonaws.com', '')
    const modifiedBody = await transclude(response.body, bucketName, path.dirname(uri))
    return callback(null, {
      body: modifiedBody,
      bodyEncoding: 'text',
      status: '200',
      statusDescription: 'OK',
      headers: {
        ...headers,
        'content-type': [
          {
            key: 'Content-Type',
            value: 'text/html; charset=UTF-8',
          },
        ],
        'cache-control': [
          {
            key: 'Cache-Control',
            value: 'max-age=3600',
          },
        ],
      },
    })
  } else {
    // Was not an shtml file so we can serve it up as is without additional processing
    return callback(null, response)
  }
}
