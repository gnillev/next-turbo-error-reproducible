# next-turbo-error-reproducible
Small reproducing example of eror with `next dev --turbopack` and `isomorphic-git` (`pako`, actually)


## Steps to reproduce

1. Run `npm run dev-turbo`
2. Go to `http://localhost:3005`
3. Click the button and see the error:
```
Pako error: invalid distance too far back
    at listpack (index.js:2621:15)
    at async GitPackIndex.fromPack (index.js:2821:5)
    at async _fetch (index.js:8296:17)
    at async _clone (index.js:8419:42)
    at async Object.clone (index.js:8545:12)
    at async gitCloneAndPull (page.tsx:125:7)
```

To verify it works without, you can do the above, running `npm run dev` insstead.

## Details
The error is due to code compiled as "unreachable", that is actually called inside `pako`s `inflate` method.
