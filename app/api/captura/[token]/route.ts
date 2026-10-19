import { NextRequest, NextResponse } from "next/server";
import { webhookCaptacao } from "@/app/leads/actions-webhook";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const result = await webhookCaptacao(token, body);
    if (!result.ok) {
      return NextResponse.json({ erro: result.erro }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
