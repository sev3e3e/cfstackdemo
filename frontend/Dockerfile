FROM public.ecr.aws/docker/library/node:22-bookworm-slim

# Lambda WebAdapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=3000
ENV READINESS_CHECK_PATH=/
ENV AWS_LWA_INVOKE_MODE=response_stream

WORKDIR /app
COPY package.json ./
# ランタイムに必要な依存関係のみをインストール
RUN npm install --omit=dev

COPY ./build ./build

CMD ["node", "/app/build/index.js"]