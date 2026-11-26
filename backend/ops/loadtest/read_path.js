// Read-path throughput: unauthenticated catalog/health endpoints.
// Run only against an isolated/staging target. BASE_URL env required.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:8099";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 50 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<200"],
  },
};

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  const services = http.get(`${BASE}/api/v1/public/services`);
  check(services, { "services 200": (r) => r.status === 200 });

  const releases = http.get(`${BASE}/api/v1/public/app-releases`);
  check(releases, { "releases 200": (r) => r.status === 200 });

  sleep(1);
}
