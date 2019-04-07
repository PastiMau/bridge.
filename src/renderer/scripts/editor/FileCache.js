import { BASE_PATH } from "../constants";
import Store from "../../store/index";


class FileCache {
    static get current_project() {
        return Store.state.Explorer.project;
    }

    //Tests whether the file is inside the current project
    static isInProject(path) {
        return path.startsWith(`${BASE_PATH.replace(/\//g, "\\")}\\${this.current_project}`);
    }
    //Removes the BASE_PATH of a path
    static removeBase(path) {
        return path.replace(`${BASE_PATH.replace(/\//g, "\\")}\\${this.current_project}`, "");
    }
    //Get the folder path to create
    static getFolderPath(path) {
        let tmp = path.split("\\");
        tmp.pop();
        return tmp.join("\\");
    }

    static setupPath(path) {
        let folder_path = this.getFolderPath(this.removeBase(path));
    }
}

export default FileCache;