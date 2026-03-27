// ---- Define your dialogs  and panels here ----


// ---- undo/redo via snapshot pattern ----

// stacks hold full permission snapshots; prev_snapshot holds the state before the current change
let undo_stack = []
let redo_stack = []
let prev_snapshot = null
let is_undo_redo = false
const MAX_UNDO = 50

// capture full permission state for all files
function capture_snapshot() {
    let snapshot = []
    for (let filepath in path_to_file) {
        let file = path_to_file[filepath]
        snapshot.push({
            filepath: filepath,
            acl: file.acl.map(ace => ({
                who: ace.who,
                permission: ace.permission,
                is_allow_ace: ace.is_allow_ace
            })),
            using_permission_inheritance: file.using_permission_inheritance,
            owner: file.owner
        })
    }
    return snapshot
}

// write a snapshot back onto the live file objects
function restore_snapshot(snapshot) {
    for (let file_state of snapshot) {
        let file = path_to_file[file_state.filepath]
        file.acl = file_state.acl.map(ace => ({
            who: ace.who,
            permission: ace.permission,
            is_allow_ace: ace.is_allow_ace
        }))
        file.using_permission_inheritance = file_state.using_permission_inheritance
        file.owner = file_state.owner
    }
}

// grab initial snapshot before any user changes happen
prev_snapshot = capture_snapshot()

// wrap emitState to auto-capture snapshots on every permission change
let original_emit_state = emitState
emitState = function(purpose) {
    if (!is_undo_redo && prev_snapshot) {
        // push previous state onto undo stack, clear redo
        undo_stack.push(prev_snapshot)
        if (undo_stack.length > MAX_UNDO) undo_stack.shift()
        redo_stack = []
    }
    original_emit_state(purpose)
    prev_snapshot = capture_snapshot()
    update_undo_redo_buttons()
}

// compare two snapshots, return filepaths that differ
function get_changed_files(before, after) {
    let changed = []
    for (let i = 0; i < before.length; i++) {
        let b = before[i]
        let a = after[i]
        if (b.using_permission_inheritance !== a.using_permission_inheritance ||
            b.owner !== a.owner ||
            JSON.stringify(b.acl) !== JSON.stringify(a.acl)) {
            changed.push(b.filepath)
        }
    }
    return changed
}

// briefly flash the file tree row for each changed file
function flash_changed_files(filepaths) {
    for (let fp of filepaths) {
        // target the lock button for this file: e.g. "/C/docs_permbutton"
        let elem = $(document.getElementById(fp + '_permbutton'))
        if (!elem.length) continue
        // apply instant highlight, then swap to fade class on next frame
        elem.removeClass('undo-redo-fade').addClass('undo-redo-flash')
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                elem.removeClass('undo-redo-flash').addClass('undo-redo-fade')
                // clean up fade class after transition so it doesn't stick
                elem.one('transitionend', () => elem.removeClass('undo-redo-fade'))
            })
        })
    }
}

// force dialogs to re-read model data after a state restore
function refresh_ui() {
    let current_filepath = perm_dialog.attr('filepath')
    if (current_filepath) {
        // toggle filepath attr to trigger the MutationObserver reload
        perm_dialog.attr('filepath', '')
        perm_dialog.attr('filepath', current_filepath)
    }
    // reload advanced dialog if it's open
    if ($('#advdialog').dialog('isOpen')) {
        open_advanced_dialog(current_filepath)
    }
}

// revert to previous state
function undo() {
    if (undo_stack.length === 0) return
    is_undo_redo = true
    let before = capture_snapshot()
    redo_stack.push(before)
    let snapshot = undo_stack.pop()
    restore_snapshot(snapshot)
    prev_snapshot = capture_snapshot()
    original_emit_state("Undo")
    refresh_ui()
    // flash files that actually changed
    flash_changed_files(get_changed_files(before, prev_snapshot))
    is_undo_redo = false
    update_undo_redo_buttons()
}

// re-apply a previously undone state
function redo() {
    if (redo_stack.length === 0) return
    is_undo_redo = true
    let before = capture_snapshot()
    undo_stack.push(before)
    let snapshot = redo_stack.pop()
    restore_snapshot(snapshot)
    prev_snapshot = capture_snapshot()
    original_emit_state("Redo")
    refresh_ui()
    // flash files that actually changed
    flash_changed_files(get_changed_files(before, prev_snapshot))
    is_undo_redo = false
    update_undo_redo_buttons()
}

// enable/disable buttons based on stack state
function update_undo_redo_buttons() {
    $('#undo-btn').prop('disabled', undo_stack.length === 0)
    $('#redo-btn').prop('disabled', redo_stack.length === 0)
}

// add undo/redo buttons to the side panel
$('#sidepanel').append(`
    <div id="undo-redo-controls" style="padding: 10px;">
        <button id="undo-btn" class="ui-button ui-widget ui-corner-all" disabled>Undo</button>
        <button id="redo-btn" class="ui-button ui-widget ui-corner-all" disabled>Redo</button>
    </div>
`)
$('#undo-btn').click(undo)
$('#redo-btn').click(redo)

// keyboard shortcuts: ctrl+z / cmd+z for undo, ctrl+shift+z / cmd+shift+z for redo
$(document).keydown(function(e) {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); redo() }
        if (e.key === 'y')                { e.preventDefault(); redo() }
    }
})


// ---- Display file structure ----

// (recursively) makes and returns an html element (wrapped in a jquery object) for a given file object
function make_file_element(file_obj) {
    let file_hash = get_full_path(file_obj)

    if(file_obj.is_folder) {
        let folder_elem = $(`<div class='folder' id="${file_hash}_div">
            <h3 id="${file_hash}_header">
                <span class="oi oi-folder" id="${file_hash}_icon"/> ${file_obj.filename} 
                <button class="ui-button ui-widget ui-corner-all permbutton" path="${file_hash}" id="${file_hash}_permbutton"> 
                    <span class="oi oi-lock-unlocked" id="${file_hash}_permicon"/> 
                </button>
            </h3>
        </div>`)

        // append children, if any:
        if( file_hash in parent_to_children) {
            let container_elem = $("<div class='folder_contents'></div>")
            folder_elem.append(container_elem)
            for(child_file of parent_to_children[file_hash]) {
                let child_elem = make_file_element(child_file)
                container_elem.append(child_elem)
            }
        }
        return folder_elem
    }
    else {
        return $(`<div class='file'  id="${file_hash}_div">
            <span class="oi oi-file" id="${file_hash}_icon"/> ${file_obj.filename}
            <button class="ui-button ui-widget ui-corner-all permbutton" path="${file_hash}" id="${file_hash}_permbutton"> 
                <span class="oi oi-lock-unlocked" id="${file_hash}_permicon"/> 
            </button>
        </div>`)
    }
}

for(let root_file of root_files) {
    let file_elem = make_file_element(root_file)
    $( "#filestructure" ).append( file_elem);    
}



// make folder hierarchy into an accordion structure
$('.folder').accordion({
    collapsible: true,
    heightStyle: 'content'
}) // TODO: start collapsed and check whether read permission exists before expanding?


// -- Connect File Structure lock buttons to the permission dialog --

// open permissions dialog when a permission button is clicked
$('.permbutton').click( function( e ) {
    // Set the path and open dialog:
    let path = e.currentTarget.getAttribute('path');
    perm_dialog.attr('filepath', path)
    perm_dialog.dialog('open')
    //open_permissions_dialog(path)

    // Deal with the fact that folders try to collapse/expand when you click on their permissions button:
    e.stopPropagation() // don't propagate button click to element underneath it (e.g. folder accordion)
    // Emit a click for logging purposes:
    emitter.dispatchEvent(new CustomEvent('userEvent', { detail: new ClickEntry(ActionEnum.CLICK, (e.clientX + window.pageXOffset), (e.clientY + window.pageYOffset), e.target.id,new Date().getTime()) }))
});


// ---- Assign unique ids to everything that doesn't have an ID ----
$('#html-loc').find('*').uniqueId() 