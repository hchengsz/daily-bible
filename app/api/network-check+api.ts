const CHECK_URL = "https://translation.googleapis.com";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : "";

    return [error.message, cause].filter(Boolean).join(": ");
  }

  return String(error);
};

const getProxyStatus = () => ({
  nodeUseEnvProxy: process.env.NODE_USE_ENV_PROXY === "1",
  httpProxySet: Boolean(process.env.HTTP_PROXY || process.env.http_proxy),
  httpsProxySet: Boolean(process.env.HTTPS_PROXY || process.env.https_proxy),
});

export async function GET() {
  const startedAt = Date.now();

  try {
    const response = await fetch(CHECK_URL);

    return Response.json({
      ok: true,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      proxy: getProxyStatus(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: getErrorMessage(error),
        proxy: getProxyStatus(),
      },
      { status: 502 },
    );
  }
}
