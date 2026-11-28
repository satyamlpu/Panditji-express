// OTP request throughput. Unique phone per iteration so the per-phone limit
// (5 / 10 min) doesn't dominate; the per-IP limit still applies from one load
// box — run distributed or raise the limit on the staging target.
// Run only against an isolated/staging target. BASE_URL env required.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:8099";

export const options = {
  scenarios: {
    constant: { executor: "constant-vus", vus: 20, duration: "1m" },
  },
  thresholds: {
    http_req_duration: ["p(95)<400"],
  },
};

function phone() {
  // Deterministic-ish unique Indian-format number per VU+iter.
  const n = (__VU * 100000 + __ITER) % 1000000000;
  return `+9188${String(n).padStart(8, "0")}`;
}

export default function () {
  const res = http.post(
    `${BASE}/api/v1/mp/auth/otp/request`,
    JSON.stringify({ phone: phone(), kind: "customer" }),
    { headers: { "Content-Type": "application/json" } },
  );
  // 200 = issued, 429 = rate-limited (expected under heavy single-IP load).
  check(res, { "issued or limited": (r) => r.status === 200 || r.status === 429 });
}
