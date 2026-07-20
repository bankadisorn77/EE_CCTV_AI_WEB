FROM node:22-bookworm
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5050

CMD ["npm", "start"]