import FileSystem from "../scripts/FileSystem";
import ContentWindow from "../scripts/commonWindows/Content";
import Store from "../store/index";
import FileType from "../scripts/editor/FileType";
import safeEval from "safe-eval";
import { RP_BASE_PATH, BASE_PATH } from "../scripts/constants";
import uuidv4 from "uuid/v4";

class FileContent {
    constructor(name, ext="json", parent, expand_path="", { location, ...add_content }={}, use_rp_path) {
        this.parent = parent;
        this.ext = ext;
        this.expand_path = expand_path;
        this.use_rp_path = use_rp_path;

        this.input = {
            type: "horizontal",
            center: true,
            key: uuidv4(),
            content: [
                {
                    type: "input",
                    text: "Name",
                    input: "unnamed",
                    has_focus: true,
                    color: "success",
                    key: uuidv4(),
                    action: {
                        enter: () => {
                            this.parent.createFile();
                        },
                        default: (val) => {
                            this.input.content[0].input = val;

                            if(val === "" && !this.parent.actions[1].is_disabled) {
                                this.input.content[0].color = "error";
                                this.input.key = uuidv4();
                                this.parent.actions[1].is_disabled = true;

                                this.path_info.text = "Invalid file name!\n\n"
                                this.path_info.color = "error";

                                this.parent.update({ content: this.content, actions: this.parent.actions });
                            } else if(this.parent.actions[1].is_disabled) {
                                this.input.content[0].color = "success";
                                this.input.key = uuidv4();
                                this.parent.actions[1].is_disabled = false;

                                this.path_info.text = this.getPath(val) + "\n\n";
                                this.path_info.color = "grey";

                                this.parent.win_def.actions[1].is_disabled = false;
                                this.parent.update({ content: this.content, actions: this.parent.win_def.actions });
                            }
                        }
                    }
                },
                {
                    text: `.${ext}`,
                    color: "grey"
                }
            ]
        };
        this.path_info = {
            text: this.getPath("unnamed", ext) + "\n\n",
            color: "grey"
        };

        this.content = [
            {
                type: "header",
                text: name
            },
            {
                type: "divider"
            },
            {
                text: "\n"
            },
            this.input,
            this.path_info
        ];

        if(location === undefined)
            location = {};
        if(add_content !== undefined)
            this.add({
                ...add_content,
                action: (parameter) => {
                    if(add_content.action !== undefined && add_content.action.type === "change_path") {
                        this.expand_path = safeEval(add_content.action.to, { parameter });
                        this.path_info.text = this.getPath(undefined, undefined);
                        this.parent.update({ content: this.content });
                    } else if(add_content.action !== undefined) {
                        throw new Error("Unknown add_content.action type: " + add_content.action.type);
                    }
                }
            }, ...location);
    }

    getPath(val=this.input.content[0].input, ext=this.ext, expand=this.expand_path) {
        return `${this.use_rp_path ? Store.state.Explorer.project.resource_pack : Store.state.Explorer.project.explorer}/${expand}${val}.${ext}`;
    }

    getFullPath(val, ext, expand) {
        return `${this.use_rp_path ? RP_BASE_PATH : BASE_PATH}${this.getPath(val, ext, expand)}`;
    }

    get() {
        return this.content;
    }

    add(c, i=this.content.length, r=0) {
        this.content.splice(i, r, c);
        return this;
    }
}

export default class CreateFileWindow extends ContentWindow {
    constructor(show_rp=false, apply_filter=true) {
        let FILE_DATA;
        if(apply_filter || Store.state.Explorer.project.resource_pack === undefined)
            FILE_DATA = FileType.getFileCreator().filter(f => show_rp ? f.rp_definition : !f.rp_definition);
        else FILE_DATA = FileType.getFileCreator();

        super({
            display_name: "New File",
            options: {
                is_persistent: false
            },
            sidebar: FILE_DATA.map(({ icon, title }, index) => {
                return {
                    icon,
                    title,
                    opacity: 0.25,
                    action: () => {
                        this.select(index)
                    }
                }
            })
        });

        this.createFile = () => {
            FileSystem.save(
                this.current_content.getFullPath(), 
                this.chosen_template, 
                true, 
                true
            );
            this.close();
        };
        this.actions = [
            {
                type: "space"
            },
            {
                type: "button",
                text: "Create!",
                color: "success",
                is_rounded: true,
                is_disabled: false,
                action: this.createFile
            }
        ];
        this.win_def.actions = this.actions;
        this.contents = FILE_DATA.map(({ title, extension, path, add_content, rp_definition }) => new FileContent(title, extension, this, path, add_content, rp_definition));
        this.templates = FILE_DATA.map(f => f.templates);
        this.chosen_template = "";

        this.select(0);
    }

    select(id) {
        this.current_content = this.contents[id];

        this.win_def.sidebar.forEach(e => e.opacity = 0.25);
        this.win_def.sidebar[id].opacity = 1;
        this.win_def.content = this.contents[id].get() || [ { text: "Nothing to show yet" } ];

        if(this.templates[id] && !this.win_def.content.added_select) this.compileTemplate(this.templates[id]);

        this.update();
    }

    compileTemplate(templ) {
        this.win_def.content.added_select = true;
        this.win_def.content.push({
            type: "header",
            text: "Templates"
        },
        {
            type: "divider"
        },
        {
            type: "select",
            options: ["No template"].concat(Object.keys(templ)),
            text: "Select template",
            action: (val) => {
                if(templ[val] === undefined) this.chosen_template = "";
                else if(typeof templ[val] === "string") this.chosen_template = templ[val];
                else this.chosen_template = JSON.stringify(templ[val], null, "\t");
            }
        });
    }
}