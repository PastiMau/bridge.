<template>
    <span>
        <v-container v-if="file_viewer === 'image'">
            <v-img class="image" :src="image" :style="`max-height: ${available_height}px;`"/>
        </v-container>
        <audio-player v-else-if="file_viewer === 'audio'" :src="audio"/>
        <json-error-screen v-else-if="file_viewer === 'json' && json_object == 'error'"/>
        <json-editor-main
            v-else-if="file_viewer === 'json'"
            :compiled="file.is_compiled"
            :tab_id="tab_id"
            :object="json_object"
            :available_height="available_height - 60"
            :uuid="use_uuid"
            :current_file_path="file.file_path"
        />
        <span v-else>
            <codemirror
                v-model="content_as_string"
                :options="cm_options"
                ref="cm"
            />
            <text-auto-completions/>
        </span>
    </span>
</template>

<script>
    import CodeMirror from "codemirror";
    import TextAutoCompletions from "./TextAutoCompletions";
    //Language
    import "codemirror/mode/javascript/javascript.js";
    import "codemirror/mode/xml/xml.js";

    //Style
    import "codemirror/lib/codemirror.css";
    import "codemirror/theme/monokai.css";
    import "codemirror/theme/xq-light.css";
    //import "codemirror/addon/hint/show-hint.css";

    //Other
    import "codemirror/addon/edit/closebrackets.js";
    import "codemirror/addon/comment/comment.js";
    import "codemirror/keymap/sublime.js";
    
    //Files
    import loadAllTextHighlighters from "../../scripts/editor/CMLanguage.js";

    import JsonEditorMain from "./JsonEditor/Main";
    import JsonErrorScreen from "./JsonErrorScreen";

    import cJSON from "comment-json";
    import TabSystem from '../../scripts/TabSystem';
    import Runtime from '../../scripts/plugins/Runtime';
    import EventBus from "../../scripts/EventBus";
    import TextProvider from "../../scripts/autoCompletions/TextProvider";
    import { webContents } from "electron";
    import DataUrl from "dataurl";
    import AudioPlayer from "./AudioPlayer";
    import FileType from '../../scripts/editor/FileType';

    export default {
        name: "file-manager",
        components: {
            JsonEditorMain,
            JsonErrorScreen,
            TextAutoCompletions,
            AudioPlayer
        },
        props: {
            file: Object,
            available_height: Number,
            tab_id: Number, 
            uuid: String
        },
        created() {
            loadAllTextHighlighters();
        },
        mounted() { 
            if(this.$refs.cm) {
                this.$refs.cm.$el.childNodes[1].style.height = this.available_height + "px";
                
            }
            if(!this.codemirror) return;
            
            this.codemirror.on("cursorActivity", this.shouldUpdateSuggestions);
            EventBus.on("setCMSelection", this.setCMSelection);
            EventBus.on("setCMTextSelection", this.setCMTextSelection);
            EventBus.on("getCMSelection", this.getCMSelection);
            EventBus.on("cmUndo", this.cmUndo);
            EventBus.on("cmUndo", this.cmRedo);
            EventBus.on("bridge:cmFocus", this.cmFocus);
        },
        destroyed() {
            if(!this.codemirror) return;
            EventBus.off("setCMSelection", this.setCMSelection);
            EventBus.off("setCMTextSelection", this.setCMTextSelection);
            EventBus.off("getCMSelection", this.getCMSelection);
            EventBus.off("cmUndo", this.cmUndo);
            EventBus.off("cmUndo", this.cmRedo);
            EventBus.off("bridge:cmFocus", this.cmFocus);
        },
        data() {
            return {
                alias: {
                    js: "javascript",
                    func: "mcfunction",
                    html: "text/html"
                }
            }
        },
        computed: {
            file_viewer() {
                let data = FileType.getData(this.file.file_path);
                if(data !== undefined && data.file_viewer !== undefined) return data.file_viewer;
                else if(this.extension === "json") return "json";
                else if(this.extension === "png" || this.extension === "tga") return "image";
                else if(this.extension === "ogg") return "audio";
                return "text";
            },
            extension() {
                if(this.file) return this.file.file_name.split(".").pop().toLowerCase();
            },
            use_uuid() {
                return `${this.uuid}-${Math.random()})`;
            },

            //FILE CONTENT
            image() {
                this.$store.commit("removeLoadingWindow", { id: "open-file" });
                return this.getEncoded("image", this.extension, this.file.raw_content);
            },
            audio() {
                this.$store.commit("removeLoadingWindow", { id: "open-file" });
                return this.getEncoded("audio", this.extension, this.file.raw_content);
            },
            content: {
                get() {
                    if(this.file) {
                        return this.file.content;
                    }
                    return undefined;
                },
                set(val) {
                    //this.$store.commit("setTabContent", { tab: this.tab_id, content: val });
                    TabSystem.setCurrentContent(val);
                }
            },
            content_as_string: {
                get() {
                    if(typeof this.content === "string") return this.content;
                    return JSON.stringify(this.content, null, "\t");
                },
                set(val) {
                    if(typeof this.content === "string") TabSystem.setCurrentContent(val);
                    else TabSystem.setCurrentContent(JSON.parse(val));
                }
            },
            json_object() {
                if(typeof this.content === "string") {
                    try {        
                        return cJSON.parse(this.content, undefined, true);
                    } catch(e) {
                        if(this.content == "") return {};
                        TabSystem.setCurrentInvalid();
                        this.$store.commit("removeLoadingWindow", { id: "open-file" });
                        return "error";
                    }
                }
                return this.content;
            },

            cm_options() {
                this.$store.commit("removeLoadingWindow", { id: "open-file" });
                return {
                    lineNumbers: true,
                    line: true,
                    autoCloseBrackets: true,
                    keyMap: "sublime",
                    theme: this.$store.state.Appearance.is_dark_mode ? "monokai" : "xq-light",
                    mode: this.alias[this.extension] || this.extension,
                    styleActiveLine: true,
                    showCursorWhenSelecting: true,
                    lineWrapping: this.$store.state.Settings.line_wraps,
                    extraKeys: {
                        "Ctrl-Space": this.shouldUpdateSuggestions,
                        "Up": () => {
                            EventBus.trigger("bridge:textCompletionsOpen", (is_open) => {
                                if(is_open) EventBus.trigger("bridge:textCompletionsUp");
                                else {
                                    let pos = { line: this.codemirror.doc.getCursor().line - 1, ch: this.codemirror.doc.getCursor().ch };
                                    this.setCMTextSelection(pos);
                                }
                            });
                        },
                        "Down": () => {
                            EventBus.trigger("bridge:textCompletionsOpen", (is_open) => {
                                if(is_open) EventBus.trigger("bridge:textCompletionsDown");
                                else {
                                    let pos = { line: this.codemirror.doc.getCursor().line + 1, ch: this.codemirror.doc.getCursor().ch };
                                    this.setCMTextSelection(pos);
                                }
                            });
                        },
                        "Tab": () => {
                            EventBus.trigger("bridge:textCompletionsOpen", (is_open) => {
                                if(is_open) EventBus.trigger("bridge:textCompletionsEnter");
                                else return this.setCMSelection("\n");
                            });
                        }
                    }
                };
            },
            codemirror() {
                if(this.$refs.cm == undefined) return;
                return this.$refs.cm.codemirror;
            }
        },
        methods: {
            setCMTextSelection(sel_obj_1, sel_obj_2) {
                this.codemirror.setSelection(sel_obj_1, sel_obj_2);
            },
            setCMSelection(str) {
                this.codemirror.replaceSelection(str);
            },
            getCMSelection(cb) {
                cb(this.codemirror.getSelection());
            },
            cmUndo() {
                this.codemirror.execCommand("undo");
            },
            cmRedo() {
                this.codemirror.execCommand("redo");
            },
            cmFocus() {
                this.codemirror.focus();
            },
            shouldUpdateSuggestions(event) {
                TextProvider.compile(event.doc, this.file.file_path);
            },
            getEncoded(type, ext, data) {
                return DataUrl.convert({
                    data,
                    mimetype: `${type}/${ext}`
                });
            }
        },
        watch: {
            available_height() {
                if(this.$refs.cm) this.$refs.cm.$el.childNodes[1].style.height = this.available_height + "px";
            },
            content_as_string() {
                if(this.file_viewer !== 'json') TabSystem.setCurrentUnsaved();
            }
        }
    }
</script>

<style>
    .CodeMirror.cm-s-monokai > * {
        background: #303030;
    }
    .cm-s-monokai .CodeMirror-gutter, .cm-s-monokai .CodeMirror-linenumbers {
        background: rgb(60, 60, 60);
    }
    .cm-s-monokai .CodeMirror-selected {
        background: rgb(60, 60, 60) !important;
    }
    .CodeMirror-vscrollbar {
        outline: none !important;
    }
</style>
<style scoped>
    .image {
        image-rendering: pixelated;
    }
</style>