FROM node:12-alpine
MAINTAINER Ripple Operations <ops@ripple.com>


RUN apk add --no-cache openssl ca-certificates

# Generate self-signed wildcard certificate
RUN openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout faucet.com.key -out faucet.com.crt \
  -subj "/CN=*.ripplesandbox.com/O=RippleLabs/OU=RippleX/L=San Francisco/ST=CA/C=US"

# Copy the certificate and key into the container
COPY faucet.com.crt /etc/ssl/certs/
COPY faucet.com.key /etc/ssl/private/

# Set environment variables for the SSL/TLS configuration
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/faucet.com.crt
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/private/faucet.com.key

# Update the CA certificate bundle
RUN update-ca-certificates

#workdir
RUN mkdir /faucet
ADD . / faucet/
RUN npm --prefix faucet install

WORKDIR /faucet

CMD npm start
