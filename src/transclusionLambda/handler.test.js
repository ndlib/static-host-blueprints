const nock = require('nock')
const testHandler = require('./handler').handler

const hostname = 'www.example.com'
const indexBody = `
  <html>
  <body>
    <!--#include virtual="/include1.shtml" -->
    <div>This is an example.</div>
    <!-- #include virtual="/include2.shtml" -->
  </body>
  </html>
`
const firstIncludeBody = `
    <div>
      <h1>Navigation or something</h1>
      <!-- #include virtual="/foo/nestedInclude.shtml"-->
    </div>
`
const nestedIncludeBody = '<span>I go under the nav heading</span>'
const secondIncludeBody = '<div>a footer</div>'

const testEvent = {
  Records: [
    {
      cf: {
        response: {
          status: 200,
          body: indexBody,
        },
        request: {
          uri: '/index.shtml',
          headers: {
            host: [
              {
                key: 'Host',
                value: hostname,
              },
            ],
          },
        },
      },
    },
  ],
}

describe('transclusionLambda handler', () => {
  test('recursively replaces includes with correct body content', async () => {
    const firstIncludeNock = nock('https://' + hostname)
      .get('/include1.shtml')
      .reply(200, firstIncludeBody)
    const secondIncludeNock = nock('https://' + hostname)
      .get('/include2.shtml')
      .reply(200, secondIncludeBody)
    const nestedIncludeNock = nock('https://' + hostname)
      .get('/foo/nestedInclude.shtml')
      .reply(200, nestedIncludeBody)

    const mockCallback = (ignore, data) => {
      const expectedBody = `
  <html>
  <body>
    
    <div>
      <h1>Navigation or something</h1>
      <span>I go under the nav heading</span>
    </div>

    <div>This is an example.</div>
    <div>a footer</div>
  </body>
  </html>
`
      const expected = {
        body: expectedBody,
        bodyEncoding: 'text',
        status: '200',
        statusDescription: 'OK',
        headers: {
          host: [
            {
              key: 'Host',
              value: hostname,
            },
          ],
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
      }
      expect(data).toEqual(expected)
      expect(firstIncludeNock.isDone()).toBe(true)
      expect(secondIncludeNock.isDone()).toBe(true)
      expect(nestedIncludeNock.isDone()).toBe(true)
    }

    await testHandler(testEvent, null, mockCallback)
  })
})
