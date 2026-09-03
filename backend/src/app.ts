import express from "express";
import cors from "cors";
import employeeRoutes from "./routes/EmployeeRoute";
import { errorMiddleware } from "./middlewares/ErrorMiddleware";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Employee Management API is running");
});

app.listen(3000, () => {
  console.log("Employee Management API is running on port 3000");
});
app.use("/employees", employeeRoutes);

app.use(errorMiddleware);

export default app;
