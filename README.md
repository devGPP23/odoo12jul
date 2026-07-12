# AssetFlow 🚀

Hey there! Welcome to **AssetFlow**, a centralized ERP platform built to simplify how organizations track, allocate, and maintain their physical assets and shared resources.

This project is split into a robust Node.js backend (with Prisma, Postgres, Mongo, and Redis) and a fast React + Vite frontend.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Prisma, Postgres, MongoDB (for logs), Redis (for caching & pub/sub)
- **Frontend:** React, Vite, Tailwind CSS, React Router
- **Infra:** Docker & Docker Compose

---

## 📖 How to Run the Project (Working Manual)

Follow these simple steps to get everything up and running on your local machine.

### Step 1: Start the Databases
We use Docker to make database setup painless. You don't need to install Postgres or Mongo manually!
1. Make sure you have Docker Desktop installed and running.
2. Open your terminal in the root folder of this project.
3. Run the following command:
   ```bash
   docker-compose up -d
   ```
   *(This will start Postgres, MongoDB, and Redis in the background).*

### Step 2: Setup the Backend
Now let's get the Node server running.
1. Open a terminal and navigate to the `server` folder:
   ```bash
   cd server
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Copy the `.env.example` file to `.env` (if you haven't already). The default Docker URLs are already set!
4. Sync the database schema using Prisma:
   ```bash
   npx prisma db push
   ```
5. Seed the database with some initial dummy data (Optional but recommended):
   ```bash
   npm run seed
   ```
6. Start the server:
   ```bash
   npm run dev
   ```
   *(The backend should now be running on `http://localhost:5000`)*

### Step 3: Setup the Frontend
Finally, let's start the React app.
1. Open a **new** terminal and navigate to the `client` folder:
   ```bash
   cd client
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *(The frontend should now be running on `http://localhost:5173`)*

---

## 💡 Troubleshooting

- **Redis Port Error:** If Docker complains that port `6379` is already in use, it means you have a local Redis running. Either stop your local Redis, or change the port mapping in `docker-compose.yml` to `"6380:6379"` and update your `.env` accordingly.
- **Prisma Error:** If you get a Prisma client error, make sure your Postgres container is fully running before you execute `npx prisma db push`.

Enjoy building and managing assets with AssetFlow! 🎉
