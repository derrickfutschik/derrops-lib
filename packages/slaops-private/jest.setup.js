// Set NODE_OPTIONS for ESM support when running tests from IDE
if (!process.env.NODE_OPTIONS?.includes('--experimental-vm-modules')) {
  console.warn(
    'Warning: NODE_OPTIONS=--experimental-vm-modules not set. Tests may fail in IDE.'
  );
}
