const https = require('https')
const path = require('path')

const commonGet = async (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let data = ''

        response.on('data', (chunk) => {
          data += chunk
        })

        response.on('end', () => {
          resolve(data)
        })
      })
      .on('error', (error) => reject(new Error('Error: ' + error)))
  })
}

const transclude = async (body, parentDir) => {
  // Get the paths of files to include from strings like: <!--#include virtual="foo/bar.shtml" -->
  const includesRegex = /<!--\s?#include virtual="(.+?)"\s?-->/g
  const matches = Array.from(body.matchAll(includesRegex))

  // Fetch all included files
  const promises = matches.map((match) => commonGet('https://' + path.normalize(path.join(parentDir, match[1]))))
  return Promise.all(promises).then(async (pages) => {
    // Also need to transclude the included page if it is an shtml file
    const includedBodies = await pages.map(async (pageBody, index) => {
      const filepath = matches[index][1]
      const pageDir = path.normalize(path.join(parentDir, path.dirname(filepath)))
      const resultBody = path.extname(filepath) === '.shtml' ? await transclude(pageBody, pageDir) : pageBody
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

exports.handler = async (event, context, callback) => {
  const response = event.Records[0].cf.response
  const request = event.Records[0].cf.request
  const headers = request.headers
  const host = headers.host[0].value
  const uri = request.uri

  if (uri === '/' || path.extname(uri) === '.shtml') {
    const modifiedBody = await transclude(response.body, `${host}${path.dirname(uri)}`)
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
    return callback(null, request)
  }
}
