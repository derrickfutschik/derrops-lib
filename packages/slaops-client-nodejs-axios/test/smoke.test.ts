import { describe, it, expect } from '@jest/globals';
import axios, { AxiosStatic } from 'axios';
import { attachSlaOpsInterceptor, addInterceptor } from '../src/index.js';

async function testRequest() {
  const { data } = await axios.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: -37.81,
      longitude: 144.96,
      hourly: "temperature_2m,precipitation"
    }
  });
  return data;
}


describe('basic', () => {

  beforeEach(() => {
    axios.interceptors.request.clear();
    axios.interceptors.response.clear();
  });




  it('attachSlaOpsInterceptor', async () => {

    attachSlaOpsInterceptor(axios, {
      endpoint: 'http://localhost:3000',
      apiKey: 'test',
      projectId: 'test',
    })

    const data = await testRequest()
    console.log({ data });
    expect(data).toBeTruthy();
  });

  it("attachSlaOpsInterceptor again", async () => {

    addInterceptor(axios);
    const data = await testRequest();
    console.log({ data });
    expect(data).toBeTruthy();
  });

});

