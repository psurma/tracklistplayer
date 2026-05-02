'use strict';

// Tiny shared logger — replaces silent `catch (_) {}` and ad-hoc console.log
// so that swallowed failures show up in the terminal/electron console.

function fmt(err) {
  if (!err) return '(no error)';
  if (err instanceof Error) return err.message + (err.code ? ` [${err.code}]` : '');
  return String(err);
}

function logWarn(ctx, err, extra) {
  if (extra !== undefined) console.warn(`[${ctx}]`, fmt(err), extra);
  else console.warn(`[${ctx}]`, fmt(err));
}

function logError(ctx, err, extra) {
  if (extra !== undefined) console.error(`[${ctx}]`, fmt(err), extra);
  else console.error(`[${ctx}]`, fmt(err));
}

function logInfo(ctx, msg, extra) {
  if (extra !== undefined) console.log(`[${ctx}] ${msg}`, extra);
  else console.log(`[${ctx}] ${msg}`);
}

module.exports = { logWarn, logError, logInfo };
