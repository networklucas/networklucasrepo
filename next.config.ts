import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { '/api/**': ['./private-data/corpus.json.gz', './private-data/skill/**/*'], '/api/books/**':['./private-data/books/*.pdf'] },
  async headers() {
    return [{ source: '/(.*)', headers: [
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'same-origin'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Cache-Control',value:'private, no-store, max-age=0'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
    ] }];
  }
};
export default config;
