// Full customer write path: OTP request -> verify -> create immediate booking
// (which triggers dispatch). Requires the staging target to run with
// sms_provider=none so the dev OTP code is returned in the response.
// Run only against an isolated/staging target. BASE_URL env required.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:8099";
// A published service slug seeded on the target (override via env).
const SERVICE_SLUG = __ENV.SERVICE_SLUG || "published-puja";
// Destination coordinates (override via env to match seeded partners).
const LAT = Number(__ENV.LAT || 26.451);
const LNG = Number(__ENV.LNG || 80.331);

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{name:create_booking}": ["p(95)<800"],
  },
};

const JSON_HDR = { headers: { "Content-Type": "application/json" } };

function phone() {
  const n = (__VU * 100000 + __ITER) % 1000000000;
  return `+9177${String(n).padStart(8, "0")}`;
}

export default function () {
  const ph = phone();

  const req = http.post(
    `${BASE}/api/v1/mp/auth/otp/request`,
    JSON.stringify({ phone: ph, kind: "customer" }),
    JSON_HDR,
  );
  if (req.status !== 200) return;
  const code = req.json("dev_code");
  if (!code) return; // target not in dev-OTP mode — can't proceed safely

  const verify = http.post(
    `${BASE}/api/v1/mp/auth/otp/verify`,
    JSON.stringify({ phone: ph, kind: "customer", code, name: "Load Test" }),
    JSON_HDR,
  );
  check(verify, { "verified": (r) => r.status === 200 });
  const token = verify.json("access_token");
  if (!token) return;

  const booking = http.post(
    `${BASE}/api/v1/mp/customer/bookings`,
    JSON.stringify({
      service_slug: SERVICE_SLUG,
      mode: "immediate",
      address_line: "Load test address",
      lat: LAT,
      lng: LNG,
    }),
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, tags: { name: "create_booking" } },
  );
  check(booking, { "booking created": (r) => r.status === 201 });
}
