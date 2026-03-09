# Employee Management Project

This project is a Full Stack application for managing employees, consisting of a Vue.js frontend and a Node.js backend, orchestrated via Docker Compose.

## 🐳 Running Docker Compose

The development environment is fully containerized. To start the application:

1. The development environment is fully containerized. To start the application:
2. From the project root, run:

    ```bash
    docker-compose up --build
    ```

    This will build the images and start the containers for the database, backend, and frontend.

## 🗄️ Running Migrations

The backend container automatically runs migrations and seeds with default employee data as part of the Docker Compose startup.

## 🌐 Accessing the Application

Once Docker Compose is running:

*   **Frontend:** Open your browser at http://localhost:5173
 (or the port configured in your docker-compose.yml, usually 5173).
*   **API (Backend):** Available at http://localhost:3000

## 🧪 Running Tests

To execute automated tests inside the containers:

**Backend Tests:**
```bash
docker-compose exec api npm run test
```