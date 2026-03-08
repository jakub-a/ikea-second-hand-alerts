export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init
  });

export const text = (data, init = {}) =>
  new Response(data, {
    headers: { 'Content-Type': 'text/plain', ...init.headers },
    ...init
  });

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
