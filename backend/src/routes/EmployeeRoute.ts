import { Router } from "express"
import EmployeeController from "../controllers/EmployeeController"
import { upload } from "../utils/upload";

const router = Router()

router.post("/import", upload.single("file"), EmployeeController.import);

router.get("/export", EmployeeController.export);

router.get("/", EmployeeController.findAll);
router.get("/:uuid", EmployeeController.findById);

router.post("/", EmployeeController.create);
router.put("/:uuid", EmployeeController.update);
router.delete("/:uuid", EmployeeController.delete);

export default router