const https = require('https')
const path = require('path')

const commonGet = async (url) => {
  console.log('Fetching from url:', url)
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

const transclude = async (body, parentPage) => {
  // Get the paths of files to include from strings like: <!--#include virtual="foo/bar.shtml" -->
  const includesRegex = /<!--\s?#include virtual="(.+?)"\s?-->/g
  const matches = body.matchAll(includesRegex)

  // Fetch all included files
  const promises = matches.map((match) => commonGet(https, path.resolve(parentPage, match[1])))
  return Promise.all(promises).then((pages) => {
    // Also need to transclude the included page if it is an shtml file
    const includedBodies = pages.map((pageBody, index) => {
      const pageUrl = matches[index][1]
      return path.extname(pageUrl) === '.shtml' ? transclude(pageBody, pageUrl) : pageBody
    })
    includedBodies.forEach((includedBody, index) => {
      body = body.replace(matches[index][0], includedBody)
    })
    return body
  })
}

exports.handler = async (event) => {
  const request = event.Records[0].cf.request
  const headers = request.headers
  const host = headers.host[0].value
  const uri = request.uri

  if (uri === '/' || path.extname(uri) === '.shtml') {
    const requestedUrl = `https://${host}${uri}`
    const requestedPage = await commonGet(requestedUrl)
    const body = await transclude(requestedPage, `https://${host}${path.dirname(uri)}`)

    return {
      body: body,
      bodyEncoding: 'text',
      status: '200',
      statusDescription: 'OK',
      headers: {
        'cache-control': [
          {
            key: 'Cache-Control',
            value: 'max-age=3600',
          },
        ],
      },
    }
  } else {
    // Was not an shtml file so we can serve it up as is without additional processing
    return request
  }
}
