'use client';

import git, { HttpClient } from "isomorphic-git";
import FS from "@isomorphic-git/lightning-fs";
import { useMemo } from "react";


function fromValue(value) {
  let queue = [value];
  return {
    next() {
      return Promise.resolve({ done: queue.length === 0, value: queue.pop() });
    },
    return() {
      queue = [];
      return {};
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

function getIterator(iterable) {
  if (iterable[Symbol.asyncIterator]) {
    return iterable[Symbol.asyncIterator]();
  }
  if (iterable[Symbol.iterator]) {
    return iterable[Symbol.iterator]();
  }
  if (iterable.next) {
    return iterable;
  }
  return fromValue(iterable);
}

async function forAwait(iterable, cb) {
  const iter = getIterator(iterable);
  while (true) {
    const { value, done } = await iter.next();
    if (value) await cb(value);
    if (done) break;
  }
  if (iter.return) iter.return();
}


async function collect(iterable) {
  let size = 0;
  const buffers = [];
  // This will be easier once `for await ... of` loops are available.
  await forAwait(iterable, (value) => {
    buffers.push(value);
    size += value.byteLength;
  });
  const result = new Uint8Array(size);
  let nextIndex = 0;
  for (const buffer of buffers) {
    result.set(buffer, nextIndex);
    nextIndex += buffer.byteLength;
  }
  return result;
}

function fromStream(stream) {
  // Use native async iteration if it's available.
  if (stream[Symbol.asyncIterator]) return stream;
  const reader = stream.getReader();
  return {
    next() {
      return reader.read();
    },
    return() {
      reader.releaseLock();
      return {};
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

const http: HttpClient = {
  async request({ url, method, headers, body }) {
    // streaming uploads aren't possible yet in the browser
    if (body) {
      body = await collect(body);
    }
    headers = {'Access-Control-Allow-Origin': '*', ...headers}
    const res = await fetch(url, {
      method,
      headers,
      body
    });
    const iter = res.body?.getReader
      ? fromStream(res.body)
      : [new Uint8Array(await res.arrayBuffer())];
    // convert Header object to ordinary JSON
    headers = {};
    for (const [key, value] of res.headers.entries()) {
      headers[key] = value;
    }
    return {
      url: res.url,
      method: method,
      statusCode: res.status,
      statusMessage: res.statusText,
      body: iter,
      headers: headers,
    };
  },
};


export default function Home() {
  const fs = useMemo(() => new FS("browser").promises, []);
  const dir = useMemo(() => `/workspace`, []);
  
  const repo_remote_url = "https://github.com/vercel/turborepo"
  const repo_branch = "main"

  const gitCloneAndPull = async (): Promise<void> => {
    indexedDB.deleteDatabase("browser");
    try {
      await git.clone({
        fs,
        http,
        dir,
        corsProxy: 'https://cors.isomorphic-git.org',
        url: repo_remote_url,
        ref: repo_branch,
        singleBranch: true,
        depth: 1,
      });
      // await git.pull({
      //   fs,
      //   http,
      //   dir,
      //   ref: repo_branch,
      // })
    } catch (error) {
      // Catch and rethrow, so we can add breadcrumbs and capture the error
      console.error("Error: ", {error})
      throw error;
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <button 
        className="p-2 inline-flex items-center justify-center whitespace-nowrap rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-white text-black shadow hover:bg-white/60 hover:cursor-pointer"
        onClick={() => gitCloneAndPull()}
      >
        Pull and watch me fail
      </button>
    </div>
  );
}
