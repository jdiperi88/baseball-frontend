FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV REACT_APP_PUBLIC_URL=/baseball

RUN npm run build
