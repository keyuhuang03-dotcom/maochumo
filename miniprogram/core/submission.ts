import { RequestError } from "./request";
export const requestKey = () =>
  Date.now().toString(36) +
  "-" +
  Math.random().toString(36).slice(2) +
  "-" +
  Math.random().toString(36).slice(2);
export const resultUnknown = (error: unknown) =>
  !(error instanceof RequestError) ||
  ["NETWORK_ERROR", "SERVICE_UNAVAILABLE", "INVALID_RESPONSE"].indexOf(
    error.code,
  ) >= 0;
