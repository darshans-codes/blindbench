// Native interop endpoints must be local, distinct, and supplied by the operator.
export function nativePeers(ports) {
  const values = typeof ports === 'string' && /^[1-9]\d{0,4}(?:,[1-9]\d{0,4}){2}$/u.test(ports)
    ? ports.split(',').map(Number) : [];
  if (values.length !== 3 || new Set(values).size !== 3 ||
      values.some((port) => port < 1024 || port > 65535)) {
    throw new Error('Set BLINDBENCH_NATIVE_PORTS to three distinct loopback ports (leader, helper, collector).');
  }
  const [leader, helper, collector] = values.map((port) => new URL(`http://127.0.0.1:${port}/`));
  return { aggregators: [leader, helper], collector };
}
