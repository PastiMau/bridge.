//@ts-check
import CommonProblem from "../CommonProblem";
import TabSystem from "../../../TabSystem";
import LightningCache from "../../LightningCache";

export default class EventCheck extends CommonProblem {
    constructor({ ...other }) {
        //@ts-ignore
        super(other);
        this.problem_found = false;
        this.events = undefined;
    }

    peek(node) {
        if(node.key === "event") {
            let t = node.parent.get("target");

            if(t === undefined || t === "self") {
                try {
                    let current_events = TabSystem.getSelected().content.get("minecraft:entity/events");
                    
                    if(!Object.keys(current_events.toJSON()).includes(node.data)) {
                        this.problem_found = true;
                        return true;
                    }
                } catch(e) {}
            } else {
                if(this.events === undefined) {
                    let c = LightningCache.getCompiledSync();
                    try {
                        this.events = c.entity.events;
                    } catch(e) {
                        this.events = [];
                    }
                } 

                if(!this.events.includes(node.data)) {
                    this.problem_found = true;
                    return true;
                } 
            }            
        }
        
        return false;
    }
    found() {
        return this.problem_found;
    }
    reset() {
        super.reset();
        this.problem_found = false;
        this.events = undefined;
    }
}