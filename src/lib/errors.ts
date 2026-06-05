import { NextResponse } from "next/server";

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function notFound(msg: string) {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export function tooManyRequests(msg: string) {
  return NextResponse.json({ error: msg }, { status: 429 });
}

export function internalError(msg: string) {
  return NextResponse.json({ error: msg }, { status: 500 });
}
