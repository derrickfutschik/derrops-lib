import { describe, expect, it } from '@jest/globals'
import axios from 'axios'
import { attachDerropsInterceptor } from '../src/index.js'

async function testRequest() {
  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: -37.81,
      longitude: 144.96,
      hourly: 'temperature_2m,precipitation',
    },
  })
  return data
}

describe('basic', () => {
  beforeEach(() => {
    axios.interceptors.request.clear()
    axios.interceptors.response.clear()
  })

  it('attachDerropsInterceptor', async () => {
    attachDerropsInterceptor(axios, {
      endpoint: 'http://localhost:3000',
      apiKey: 'test',
      projectId: 'test',
    })

    const data = await testRequest()
    // console.log({ data });
    expect(data).toBeTruthy()
  })

  it('attachDerropsInterceptor again', async () => {
    attachDerropsInterceptor(axios, {
      endpoint: 'http://localhost:3000',
      apiKey: 'test',
      projectId: 'test',
    })
    const data = await testRequest()
    // console.log({ data });
    expect(data).toBeTruthy()
  })
})
