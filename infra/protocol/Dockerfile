FROM mcr.microsoft.com/playwright:v1.58.2@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d

WORKDIR /opt/blindbench/infra/protocol
RUN npm install --ignore-scripts --omit=optional --no-audit --no-fund --save-exact playwright@1.58.2 \
    && npm pack --ignore-scripts --json @divviup/dap@0.9.1 > sdk-package.json \
    && node -e "if (require('./sdk-package.json')[0]?.integrity !== 'sha512-XdNtsk6813SVN1smVY9WTzrscZyNzxiVDXR/wh6O7DvXeGXTxxKgeoA3ibX4KcKqs4qdN9f+8pAanRyF2rxmQg==') process.exit(1)" \
    && tar -xOf divviup-dap-0.9.1.tgz package/dist/browser.js > divviup.js \
    && test -s divviup.js \
    && rm divviup-dap-0.9.1.tgz
COPY infra/protocol/protocol.mjs infra/protocol/probe.mjs infra/protocol/native-peers.mjs ./
COPY packages/study-policy/index.mjs /opt/blindbench/packages/study-policy/index.mjs
USER pwuser
CMD ["node", "probe.mjs"]
