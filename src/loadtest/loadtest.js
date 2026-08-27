import http from 'k6/http';

export const options = {
  scenarios: {
    api_load: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '30s',

      // k6 starts with 100 virtual users and can increase if needed
      preAllocatedVUs: 100,
      maxVUs: 1000,
    },
  },
};

export default function () {
  http.get('http://localhost:3000/health');
}