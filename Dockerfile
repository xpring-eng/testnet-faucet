FROM node:12-alpine
MAINTAINER Ripple Operations <ops@ripple.com>

RUN mkdir /faucet
ADD . / faucet/
RUN npm --prefix faucet install

WORKDIR /faucet

CMD npm start
