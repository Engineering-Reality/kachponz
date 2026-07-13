This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Required environment variables

Create `microservice/frontend/.env.local` with:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8081   # must match the port transaction_tracker's server.ts actually binds to
NEXT_PUBLIC_ROBOT_KEY=<a real service_accounts robot key, not the "amadeus_local_dev" code fallback>
```

If `NEXT_PUBLIC_API_URL` is missing or points at the wrong port, every request from
this app fails with a bare `TypeError: Failed to fetch` in the browser console —
that error is also what you get for CORS rejections, DNS failures, and connection
refused, so a port mismatch here is easy to misdiagnose as a backend bug. Check
`transaction_tracker`'s actual bound port (its startup log prints it) before
assuming anything else is wrong.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
