type Fields = Record<string, string | number | boolean | null | undefined>;
function write(level: string, message: string, fields: Fields = {}): void {
  // Never log credentials, full request headers, or response bodies.
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...fields }));
}
export const logger = {
  info: (message: string, fields?: Fields) => write('INFO', message, fields),
  warn: (message: string, fields?: Fields) => write('WARN', message, fields),
  error: (message: string, fields?: Fields) => write('ERROR', message, fields)
};
