import { describe, it, expect } from '@jest/globals';
import axios from 'axios';
import { attachSlaOpsInterceptor, SlaOpsClient } from '../src/index.js';

describe('basic', () => {
  it('constructs client', () => {
    const client = new SlaOpsClient({ endpoint: 'https://collector.example.com' });
    expect(client).toBeTruthy();
  });

  it('exposes attachSlaOpsInterceptor', () => {
    const instance = axios.create();
    expect(() =>
      attachSlaOpsInterceptor(instance, { endpoint: 'https://collector.example.com' }),
    ).not.toThrow();
  });
});
