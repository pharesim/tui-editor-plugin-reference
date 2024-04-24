import type { Context } from '@toast-ui/toastmark';
import type { PluginContext, PluginInfo, HTMLMdNode } from '@toast-ui/editor';
import type { Transaction, Selection, TextSelection } from 'prosemirror-state';
import { PluginOptions } from '@t/index';

import './css/plugin.css';

function createInput() {
    const form = document.createElement("form");
    form.innerHTML = "<input class='reference-input' id='reference-input-author' type='text' placeholder='Author(s)' />";
    form.innerHTML += "<input class='reference-input' id='reference-input-year' type='text' placeholder='Year' />";
    form.innerHTML += "<input class='reference-input' id='reference-input-title' type='text' placeholder='Title, Publisher, Pages etc.' />";
    form.innerHTML += "<input class='reference-input' id='reference-input-link' type='text' placeholder='Link or DOI or hive post' />";
    form.innerHTML += "<input class='reference-input' id='reference-input-isbn' type='text' placeholder='ISBN' />";
    form.innerHTML += "<input type='submit' value='submit' />";
    return form;
}
  
function createToolbarItemOption(element: HTMLDivElement) {
    const referenceCustomEl = document.createElement('button');
    referenceCustomEl.textContent = 'Ref';
    referenceCustomEl.className =  'toastui-editor-toolbar-icons custom';
    return {
        name: "reference",
        tooltip: "Reference",
        el: referenceCustomEl,        
        popup: {
            body: element,
            style: { width: "auto" },
        },
    };
}

function createSelection(
    tr: Transaction,
    selection: Selection,
    SelectionClass: typeof TextSelection,
    openTag: string,
    closeTag: string
) {
    const { mapping, doc } = tr;
    const { from, to, empty } = selection;
    const mappedFrom = mapping.map(from) + openTag.length;
    const mappedTo = mapping.map(to) - closeTag.length;
  
    return empty
        ? SelectionClass.create(doc, mappedTo, mappedTo)
        : SelectionClass.create(doc, mappedFrom, mappedTo);
}
  
function hasClass(element: HTMLElement, className: string) {
    return element.classList.contains(className);
}

export function findParentByClassName(el: HTMLElement, className: string) {
    let currentEl: HTMLElement | null = el;
  
    while (currentEl && !hasClass(currentEl, className)) {
        currentEl = currentEl.parentElement;
    }
  
    return currentEl;
}
  
function getCurrentEditorEl(
    referenceEl: HTMLElement,
    containerClassName: string
) {
    const editorDefaultEl = findParentByClassName(
        referenceEl,
        `toastui-editor-defaultUI`
    )!;
  
    return editorDefaultEl.querySelector<HTMLElement>(
        `.${containerClassName} .ProseMirror`
    )!;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
  
let containerClassName: string;
let currentEditorEl: HTMLElement;

export default function referencePlugin(
    context: PluginContext,
    options: PluginOptions = {}
): PluginInfo {
    const { eventEmitter, pmState } = context;
  
    eventEmitter.listen("focus", (editType) => {
        containerClassName = `toastui-editor-${editType === "markdown" ? "md" : "ww"}-container`;
    });
  
    const container = document.createElement("div");
  
    const inputForm = createInput();
  
    inputForm.onsubmit = (ev) => {
        ev.preventDefault();
        const author = document.getElementById("reference-input-author") as HTMLInputElement;
        const year = document.getElementById("reference-input-year") as HTMLInputElement;
        const title = document.getElementById("reference-input-title") as HTMLInputElement;
        const link = document.getElementById("reference-input-link") as HTMLInputElement;
        const isbn = document.getElementById("reference-input-isbn") as HTMLInputElement;
        currentEditorEl = getCurrentEditorEl(container, containerClassName);
  
        eventEmitter.emit("command", "reference", {
            author: author.value,
            year: year.value,
            title: title.value,
            link: link.value,
            isbn: isbn.value
        });
        eventEmitter.emit("closePopup");
  
        author.value = '';
        year.value = '';
        title.value = '';
        link.value = '';
        isbn.value = '';
        currentEditorEl.focus();
    };
  
    container.appendChild(inputForm);

    const toolbarItem = createToolbarItemOption(container);

    toolbarItem.el.addEventListener('click', () => {
        sleep(10).then(() => { eventEmitter.emit("command", "fillInput"); });
    });
  
    return {
        markdownCommands: {
            fillInput: ({ }, { tr, selection, schema }, dispatch) => {
                const slice = selection.content();
                const textContent = slice.content.textBetween(
                    0,
                    slice.content.size,
                    "\n"
                );
                document.getElementById('reference-input-title').value = textContent;
                return true;
            },
            reference: ({ author, year, title, link, isbn }, { tr, selection, schema }, dispatch) => {
                    const openTag = `<ref>`;
                    const closeTag = `</ref>`;
                    let reference = author+' ';
                    if(year != '') {
                        reference += '('+year+') ';
                    }
                    reference += title+' '+link+' ';
                    if(isbn != '') {
                        reference += 'ISBN: '+isbn;
                    }
                    const referenced = `${openTag}${reference.trim()}${closeTag}`;
  
                    tr.replaceSelectionWith(schema.text(referenced)).setSelection(
                        createSelection(
                            tr,
                            selection,
                            pmState.TextSelection,
                            openTag,
                            closeTag
                        )
                    );
  
                    dispatch!(tr);
  
                    return true;
            },
        },
        wysiwygCommands: {
            fillInput: ({ }, { tr, selection, schema }, dispatch) => {
                const slice = selection.content();
                const textContent = slice.content.textBetween(
                    0,
                    slice.content.size,
                    "\n"
                );
                document.getElementById('reference-input-title').value = textContent;
                return true;
            },
            reference: ({ author, year, title, link, isbn }, { tr, selection, schema }, dispatch) => {
                const { from, to } = selection;
  
                const mark = schema.marks.ref.create();
  
                tr.addMark(from, to, mark);
                dispatch!(tr);
  
                return true;
            },
        },
        toolbarItems: [
            {
                groupIndex: 4,
                itemIndex: 0,
                item: toolbarItem,
            },
        ],
        toHTMLRenderers: {
            htmlInline: {
                ref(node: HTMLMdNode, { origin, entering }: Context) {
                    //return context.entering ? [
                    //    { type: 'openTag', tagName: 'span', classNames: ['reference-rendered'] },
                    //    { type: 'text', content: node.next.literal },
                    //    { type: 'closeTag', tagName: 'span' }
                    //  ] : [ ];

                    // same error e.match when switching md->wysiwyg, also span doesn't close when it should in wysiwyg
                    //const result = origin();
                    //result.type = 'html';
                    //result.content = '</span>';
                    //if(entering) { 
                    //    result.content = '<span class="reference-rendered">';
                    //}
                    //return result;

                    // @todo breaks wysiwyg, error e.match when switching from md
                    return entering
                        ? {
                            type: "openTag",
                            //type: "html",
                            //content: '<span class="reference-rendered">',
                            tagName: "span",
                            classNames: [ "reference-rendered" ],
                        }
                        //: { type: "html", content: "</span>" };
                        : { type: "closeTag", tagName: "span" };
                },
            },
        },
    };
}