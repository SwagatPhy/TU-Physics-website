# Test fixtures

`fake-smtp-cert.pem` / `fake-smtp-key.pem`: a self-signed certificate for `localhost` /
`127.0.0.1`, used **only** by the fake SMTP server in the tests (`test/fake-smtp-server.js`).
It protects nothing and is public on purpose. Never use it on a real server.
