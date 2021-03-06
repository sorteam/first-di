import { TestModel } from "../models/TestModel";
import { reflection } from "../../src/decorators/reflection";

@reflection
export class ProductionRepository {

    private requestCounter: number = 0;

    public async getCounter(): Promise<number> {
        this.requestCounter += 1;
        return await Promise.resolve(this.requestCounter);
    }

    public async getData(): Promise<TestModel> {
        const data = new TestModel();
        data.repositoryData = "production";
        return await Promise.resolve(data);
    }

}
