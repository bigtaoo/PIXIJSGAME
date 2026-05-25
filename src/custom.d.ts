declare module '*.png';
declare module '*.ogg';

declare module '*.json' {
  const url: string;
  export default url;
}

declare const process: { env: { NODE_ENV: string } };
