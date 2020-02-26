import {InsightDatasetKind, InsightError, ResultTooLargeError} from "./IInsightFacade";
import DatasetController from "./DatasetController";
import OptionsProcessor from "./OptionsProcessor";
import FilterProcessor from "./FilterProcessor";
import TransformationProcessor from "./TransformationProcessor";

const coursesMField = new Set(["avg", "pass", "audit", "fail", "year"]);
const coursesSField = new Set(["dept", "id", "instructor", "title", "uuid"]);
const roomsSField = new Set(["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"]);
const roomsMField = new Set(["lat", "lon", "seats"]);
const Comparator = new Set(["LT", "GT", "EQ", "IS"]);
const ComparatorALL = new Set(["LT", "GT", "EQ", "IS", "AND", "OR", "NOT"]);
const options = new Set(["COLUMNS", "ORDER"]);

export default class QueryController {
    private datasetController: DatasetController;
    private currentDatasetID: string;
    private currentKind: InsightDatasetKind;
    private sections: any;
    private optionsHelper: OptionsProcessor;
    private filterProcessor: FilterProcessor;
    private transformationProcessor: TransformationProcessor;

    public initialize(controller: DatasetController) {
        this.currentKind = null;
        this.datasetController = controller;
        this.currentDatasetID = null;
        this.sections = null;
        this.optionsHelper = new OptionsProcessor(this);
        this.filterProcessor = new FilterProcessor(this);
        this.transformationProcessor = new TransformationProcessor(this);
    }

    public performQuery(query: any): Promise<any[]> {
        try {
            this.initialize(this.datasetController);
            this.validQuery(query);
            let condition: (section: any) => boolean = this.filterProcessor.processFilter(query["WHERE"]);
            let result: any[] = [];
            this.optionsHelper.getColumnKeys(query["OPTIONS"]["COLUMNS"]);
            let columnize: (section: any) => any = this.optionsHelper.getColumnizeFunction();
            for (let section of this.sections) {
                if (condition(section)) {
                    result.push(columnize(section));
                    if (result.length > 5000) {
                        throw new ResultTooLargeError("Result exceeded 5000 entries");
                    }
                }
            }
            if (query["OPTIONS"].hasOwnProperty("ORDER")) {
                result = this.optionsHelper.doOrdering(query["OPTIONS"]["ORDER"], result);
            }
            if (query.hasOwnProperty("TRANSFORMATIONS")) {
                result  = this.transformationProcessor.processTransformations(query["TRANSFORMATION"]);
            }
            return Promise.resolve(result);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    public validQuery(query: any): boolean {
        if (!(query.hasOwnProperty("WHERE"))) {
            throw new InsightError("Query missing WHERE section");
        }
        if (!(typeof query["WHERE"] === "object" && query["WHERE"] !== null)) {
            throw new InsightError("WHERE has wrong type");
        }
        if (!(query.hasOwnProperty("OPTIONS"))) {
            throw new InsightError("Query missing OPTIONS section");
        }
        if (!(query["OPTIONS"].hasOwnProperty("COLUMNS"))) {
            throw new InsightError("OPTIONS missing COLUMNS");
        }
        if (!Array.isArray(query["OPTIONS"]["COLUMNS"])) {
            throw new InsightError("COLUMNS must be an array");
        }
        for (let i of Object.keys(query["OPTIONS"])) {
            if (!options.has(i)) {
                throw new InsightError("Invalid key in options");
            }
        }
        return true;
    }

    public checkIDValid(key: string): string {
        let idstring: string = key;
        idstring = idstring.split("_", 1)[0];
        if (this.currentDatasetID == null) {
            this.currentDatasetID = idstring;
        }
        if (idstring !== this.currentDatasetID) {
            throw new InsightError("Multiple Datasets not supported");
        }
        try {
            if (this.sections == null) {
                this.sections = this.datasetController.getDatasetCourses(idstring);
                this.currentKind = this.datasetController.getDatasetKind(idstring);
            }
        } catch (err) {
            throw err;
        }
        return idstring;
    }

    public checkValidKey(key: string): boolean {
        if (this.currentKind === InsightDatasetKind.Rooms) {
            return roomsMField.has(key) || roomsSField.has(key);
        }
        if (this.currentKind === InsightDatasetKind.Courses) {
            return coursesMField.has(key) || coursesSField.has(key);
        } else {
            return false;
        }
    }

    public checkValidSKey(key: string): boolean {
        if (this.currentKind === InsightDatasetKind.Rooms) {
            return roomsSField.has(key);
        }
        if (this.currentKind === InsightDatasetKind.Courses) {
            return coursesSField.has(key);
        } else {
            return false;
        }
    }

    public checkValidMKey(key: string): boolean {
        if (this.currentKind === InsightDatasetKind.Rooms) {
            return roomsMField.has(key);
        }
        if (this.currentKind === InsightDatasetKind.Courses) {
            return coursesMField.has(key);
        } else {
            return false;
        }
    }
}
