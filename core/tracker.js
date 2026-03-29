$.fn.serializeObject = function () {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function () {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

AppEnum = {
    NURSERY_SCHOOL: 'nursery-school',
    SET: 'set',
    GENDER_MAG: 'gender-mag',
};

let $topBanner = $('#mturk-top-banner'),
    $backButton = $('#mturk-top-banner-back'),
    $ddDown = $('#mturk-top-banner-drop-down-button'),
    $ddUp = $('#mturk-top-banner-collapse-button'),
    $ddContent = $('#mturk-top-banner-drop-down-content'),
    $htmlLoc = $('#html-loc'),
    $checkbox = $('#top-banner-checkbox'),
    $textArea = $('#text-area'),
    $document = $(document),
    log = [
        new SpecialEventEntry(ActionEnum.SPECIAL_EVENT, new Date().getTime(), {
            purpose: 'This is the first event.',
        }),
    ],
    pageHistory = new PageHistory(
        '/nursery-school/initial-files/index.html',
        $backButton
    ),
    mousePosition = {
        x: 0,
        y: 0,
    },
    userData = {},
    app = '';

// function downloadObjectAsJson(exportObj = log, exportName = "log") {
//     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
//     let downloadAnchorNode = document.createElement('a');
//     downloadAnchorNode.setAttribute("href", dataStr);
//     downloadAnchorNode.setAttribute("download", exportName + ".json");
//     document.body.appendChild(downloadAnchorNode);
//     // downloadAnchorNode.click();
//     // downloadAnchorNode.remove();
// }

/**
 * Sets up the whole page on the first load.
 */
function setUpInitial() {
    /**
     * Attach all listeners to page initially, some of these may get thrown away at later times.
     */
    function attachInitialListeners() {
        $backButton.on('click', function (e) {
            e.stopPropagation();
            const response = pageHistory.backHistory();
            if (response.success) {
                log.push(
                    new SpecialEventEntry(
                        ActionEnum.BACK,
                        new Date().getTime(),
                        response.url
                    )
                );
                standardLoad(response.url);
            }
        });

        $('#mturk-top-banner-arrow').on('click', () => {
            if ($ddContent.is(':visible')) {
                $ddContent.hide();
                $ddUp.hide();
                $ddDown.show();
            } else {
                $ddContent.show();
                $ddUp.show();
                $ddDown.hide();
            }
        });

        $('#scenario_input').on('change', function (e) {
            userData.taskData.response = e.target.value;
        });

        $htmlLoc.on('click', function (e) {
            if (e.originalEvent.logged === undefined) {
                const le = new ClickEntry(
                    ActionEnum.CLICK,
                    e.clientX + window.pageXOffset,
                    e.clientY + window.pageYOffset,
                    e.target.id,
                    new Date().getTime()
                );
                log.push(le);
                e.originalEvent.logged = true;
            }
        });

        $htmlLoc.on('mousemove', function (e) {
            mousePosition.x = e.clientX + window.pageXOffset;
            mousePosition.y = e.clientY + window.pageYOffset;
        });

        $document.keypress(function (e) {
            if (e.target.id !== 'scenario_input') {
                let le = new ButtonDownEntry(
                    ActionEnum.BUTTON_DOWN,
                    mousePosition.x,
                    mousePosition.y,
                    e.target.id,
                    e.key,
                    new Date().getTime()
                );
                log.push(le);
            }
        });
        let lastTop = { x: 0, y: 0 };
        $document.scroll(function (e) {
            let dx = $document.scrollLeft(),
                dy = $document.scrollTop(),
                dtime = new Date().getTime();
            if (
                Math.abs(lastTop.x - dx) > 10 ||
                Math.abs(lastTop.y - dy) > 10
            ) {
                lastTop.x = dx;
                lastTop.y = dy;
                lastItem = log[log.length - 1];
                if (
                    lastItem &&
                    lastItem.action &&
                    lastItem.action === ActionEnum.SCROLL &&
                    dtime - lastItem.time <= 20
                ) {
                    lastItem.time = dtime;
                    lastItem.x = dx;
                    lastItem.y = dy;
                } else {
                    let le = new ScrollEntry(ActionEnum.SCROLL, dtime, dx, dy);
                    log.push(le);
                }
            }
        });
        $checkbox.on('click', (e) => {
            console.log(e);
            $checkbox.doChange();
            const curURL = pageHistory.currentPage;
            const index = userData.infoPages.indexOf(curURL);
            if (index !== -1) {
                userData.infoPages.splice(index, 1);
            } else {
                userData.infoPages.push(curURL);
            }
        });
        $checkbox.doChange = (checked) => {
            if (checked === undefined) {
                checked = $checkbox[0].checked;
            } else {
                $checkbox[0].checked = checked;
            }
            $textArea[0].disabled = !checked;
        };
        attachFormListener();
    }

    /**
     * Collect initial data about the user. Time and screen size are two important ones.
     */
    function collectInitialData() {
        // ********* This is a section dependent on app. ************//
        let scen_context = '';
        let scen_question = '';
        let scen_task_tag = '';
        app = $htmlLoc.data('app');
        if (app === AppEnum.NURSERY_SCHOOL) {
            scen_context = $('#scenario_context').text().trim();
            scen_question = $('#scenario_question').text().trim();
            scen_task_tag = $('#scenario_context').data('tag');
        }
        if (app === AppEnum.GENDER_MAG) {
            scen_task_tag = $('#scenario_context').data('tag');
            scen_context = $('#scenario_context').text().trim();
        }
        userData = new UserData(
            log,
            scen_context,
            scen_question,
            scen_task_tag,
            app,
            window.location.search,
            window.innerWidth,
            window.innerHeight,
            new Date().getTime(),
            pageHistory.completeHistory
        );
        userData['file_mapping'] = $('#html-loc').data('tag');
    }

    // Run all necessary start up scripts.

    $textArea.disabled = true;
    collectInitialData();
    attachInitialListeners();
    // ********* This is a section dependent on app. ************//
    if ($htmlLoc.data('page') !== undefined) {
        standardLoad($htmlLoc.data('page'));
        $ddContent.show();
    }
    nsready = () => {
        standardLoad($htmlLoc.data('page'));
        $ddContent.show();
    };

    setready = () => {
        controller.addChangeListener('userEvent', (e) => {
            log.push(e.detail.data);
        });
        $ddContent.show();
    };

    gmready = () => {
        emitter.addEventListener('userEvent', (e) => {
            log.push(e.detail);
        });
    };

    if (app === AppEnum.NURSERY_SCHOOL) {
        nsready();
    } else if (app === AppEnum.SET) {
        setready();
    } else if (app === AppEnum.GENDER_MAG) {
        gmready();
    }
}

/**
 * Attaches ids to all elements to make sure that they can be easily tracked later.
 */
function attachIdsToAllElements() {
    $('#html-loc *').each(function (index, elem) {
        if (!elem.id) {
            elem.id = 'id-' + index;
        }
    });
}

/**
 * Attaches special listeners to all links to prevent whole page redirects, essentially
 * making this a single page application.
 */
function attachLinkListeners() {
    $('#html-loc a').on(
        'click',
        /**
         *
         * @param {MouseEvent} e
         */
        function (e) {
            if (e.target.href.includes('#')) {
                return;
            }
            const nextURL = pageHistory.forwardHistory(
                new URL(e.target.href).pathname
            );
            e.preventDefault();
            if (!e.target.classList.contains('download')) {
                standardLoad(nextURL);
            } else {
                let elem = e.target;
                if (
                    elem.nextElementSibling &&
                    elem.nextElementSibling.dataset.attachment &&
                    elem.nextElementSibling.dataset.attachment === 'true'
                ) {
                    //pass
                } else {
                    let df = document
                        .createRange()
                        .createContextualFragment(
                            `<br data-attachment="true"><iframe width="100%" height="400" src="${e.target.href}"></iframe>`
                        );
                    elem.parentNode.insertBefore(df, elem.nextElementSibling);
                }
            }
        }
    );
}

/**
 * Attaches special listeners to all images to prevent whole page redirects, essentially
 * making this a single page application.
 */
function attachImageListeners() {
    $('#html-loc img').on('click', function (e) {
        e.preventDefault();
        const pageURL = '/nursery-school/initial-files/single_image.html',
            imageURL = e.target.src;
        pageHistory.forwardHistory(new URL(e.target.href).pathname, imageURL);
        standardLoad(pageURL, () => {
            $('#single-image').attr({ src: imageURL });
        });
    });
}

var $mturkSubmitForm = $('#mturk-submit-form');

/**
 * Attaches the submission form listener that will first submit the data to S3
 * then if all went smoothly will submit back to MTurk signifying the completion
 * of the HIT.
 */
function attachFormListener() {
    let urlParams = new URLSearchParams(window.location.search);
    let assignmentid = urlParams.get('assignmentId');
    if (assignmentid === null) {
        assignmentid = 'test' + Math.round(10000 * Math.random());
    }
    console.log(assignmentid);
    $('#assignment-id').val(assignmentid);
    let hitid = urlParams.get('hitId');
    if (hitid === null) {
        hitid = 'test' + Math.round(10000 * Math.random());
    }
    $('#hit-id').val(hitid);
    console.log(hitid);
    attachFormListener2();
}

function attachFormListener2() {
    $debugField = $('#debug');
    let onError = (message, source, lineno, colno, error) => {
        const eMessage =
            error === null || error === undefined || error.message === null
                ? 'NA'
                : error.message;
        let newVal =
            $debugField.val() +
            '_0_0_' +
            eMessage +
            '_0_0_' +
            message +
            '_0_0_';
        $debugField.val(newVal);
    };
    window.onerror = onError;

    const k = 'NcF2WRkUbf5tzj4bIvI981FqmS6pMlO83g2j7u5R';
    const gate =
        'https://2ykopq1oha.execute-api.us-east-1.amazonaws.com/PROD/logs';

    $mturkSubmitForm = $('#mturk-submit-form');

    let submitFunc = async (e) => {
        e.preventDefault();

        pageHistory.forwardHistory('');

        const all_the_data = $mturkSubmitForm.serializeObject();

        userData.taskData.response = {
            finished_option: all_the_data.finished_option,
            task_response_complications:
                all_the_data.task_response_complications,
            task_response_unable: all_the_data.task_response_unable,
        };

        let urlParams = new URLSearchParams(window.location.search);
        let sandbox = urlParams.get('sandbox');
        sandbox = sandbox === 'true';
        let wustl_key = urlParams.get('wustl_key');
        let project = urlParams.get('project');
        let iteration = urlParams.get('iteration');
        iteration = parseInt(iteration);
        let tag = urlParams.get('tag');
        let assignmentID = urlParams.get('assignmentId');
        let hitID = urlParams.get('hitId');
        let workerID = urlParams.get('workerId');
        let submitTo = urlParams.get('turkSubmitTo') + '/mturk/externalSubmit';
        userData.sandbox = sandbox;
        userData.wustl_key = wustl_key;
        userData.project = project;
        userData.iteration = iteration;
        userData.tag = tag;
        userData.assignmentID = assignmentID;
        userData.hitID = hitID;
        userData.workerID = workerID;
        $('#hit-id').val(hitID);
        $('#assignment-id').val(assignmentID);
        // $mturkSubmitForm.action = submitTo;

        console.log("USER DATA for: " + userData.tag);
        console.log(JSON.stringify(userData));
        alert(
                    'Open the dev console to see user data. '
                );
        // const resp = await fetch(gate, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'x-api-key': k,
        //     },
        //     body: JSON.stringify({
        //         sandbox: sandbox,
        //         wustl_key: wustl_key,
        //         project: project,
        //         iteration: iteration,
        //         tag: tag,
        //         assignmentID: assignmentID,
        //         hitID: hitID,
        //         workerID: workerID,
        //         log: JSON.stringify(userData),
        //     }),
        // });
        // console.log(resp.status);
        // const respJSON = await resp.json();
        // console.log(respJSON);
        // if (resp.status !== 200) {
        //     alert(
        //         'You made a bad request with your submission. The server thinks that you made this error: ' +
        //             respJSON.error
        //     );
        //     return;
        // }
        // $mturkSubmitForm.off('submit', submitFunc);
        // $mturkSubmitForm.submit();
    };
    $mturkSubmitForm.on('submit', submitFunc);
}

/*
Attaching listeners to all forms that are not the main submission form so that they do not submit, thus causing an error.
*/
function attachFormListeners() {
    $('#html-loc form').on('submit', function (e) {
        e.preventDefault();
        alert('All forms except for the one in the top header are inactive.');
    });
}

/**
 * Runs every time a new page is loaded into this page to make sure that everything
 * redirects properly and all elements are more easily trackable.
 */
function setUpAfterLoad() {
    attachIdsToAllElements();
    attachLinkListeners();
    attachImageListeners();
    attachFormListeners();
}

/**
 * Loads the html at location url into the page using the standard jquery load method.
 *
 * @param {string} location - url of new page to load.
 * @param {function} extraWork - extra work to perform after load has completed.
 */
function standardLoad(location, extraWork) {
    $htmlLoc.load(location, function () {
        console.log(location);
        const checked = userData.infoPages.indexOf(location) !== -1;
        $checkbox.doChange(checked);
        setUpAfterLoad();
        if (typeof extraWork === 'function') {
            extraWork();
        }
    });
}

/**
 * Set up document on ready.
 */
$document.ready(setUpInitial);

function addExplanationIcons() {
  // remove old icons first so they do not duplicate
  document.querySelectorAll(".feature-info-icon").forEach(icon => icon.remove());

  function makeInfoIcon(explanation) {
    const info = document.createElement("span");
    info.className = "feature-info-icon";
    info.textContent = "ⓘ";
    info.setAttribute("data-explanation", explanation);
    info.style.marginLeft = "8px";
    info.style.cursor = "pointer";
    info.style.display = "inline-block";
    info.style.fontSize = "0.9em";

    info.addEventListener("click", function (ev) {
      ev.stopPropagation();
      showExplanationPopup(
        info.getAttribute("data-explanation"),
        ev.pageX,
        ev.pageY
      );
    });

    return info;
  }

  // helper: find first element whose text includes some phrase
  function findElementByText(selector, text) {
    return Array.from(document.querySelectorAll(selector)).find(el =>
      el.textContent && el.textContent.trim().includes(text)
    );
  }

  // 1) Effective Permissions tab
  const effectivePermissionsTab = findElementByText("*", "Effective Permissions");
  if (effectivePermissionsTab) {
    effectivePermissionsTab.insertAdjacentElement(
      "afterend",
      makeInfoIcon(
        "Effective permissions show the access a selected user or group actually has after the system considers all relevant permission settings together. This helps you see the final result instead of checking each entry one by one."
      )
    );
  }

  // 2) Inherited from column header
  const inheritedFromHeader = findElementByText("*", "Inherited from");
  if (inheritedFromHeader) {
    inheritedFromHeader.insertAdjacentElement(
      "afterend",
      makeInfoIcon(
        "This column shows where a permission came from. If a permission is inherited, it came from a parent folder or higher-level object. If it says not inherited, that permission was set directly on this item."
      )
    );
  }

  // 3) Include inheritable permissions checkbox text
  const includeInheritedLabel = findElementByText(
    "*",
    "Include inheritable permissions from this object's parent"
  );
  if (includeInheritedLabel) {
    includeInheritedLabel.insertAdjacentElement(
      "afterend",
      makeInfoIcon(
        "Turn this on to let this item receive permissions from its parent. This can make permission management simpler because the item follows the broader access rules above it."
      )
    );
  }


  // 4) Replace child permissions checkbox text
  const replaceChildLabel = findElementByText(
    "*",
    "Replace all child object permissions with inheritable permissions from this object"
  );
  if (replaceChildLabel) {
    replaceChildLabel.insertAdjacentElement(
      "afterend",
      makeInfoIcon(
        "Use this when you want child files and folders to stop using their own separate permission entries and instead inherit from this object. This can change access for many items at once, so it should be used carefully."
      )
    );
  }

  // 5) Edit button
  const editButton = Array.from(document.querySelectorAll("button, .ui-button"))
    .find(btn => btn.textContent && btn.textContent.trim().includes("Edit"));
  if (editButton) {
    editButton.insertAdjacentElement(
      "afterend",
      makeInfoIcon(
        "Edit lets you change the currently selected permission entry. This is useful when you want to revise an existing rule instead of adding a new one."
      )
    );
  }

  // 6) Permissions tab
  const permissionsTab = findElementByText("*", "Permissions");
  if (permissionsTab) {
    permissionsTab.insertAdjacentElement(
      "afterend",
      makeInfoIcon(
        "This tab lists the explicit permission entries attached to this item. It helps you see who has access and whether those entries are inherited or directly assigned."
      )
    );
  }

  // 7) Owner tab
  const ownerTab = findElementByText("*", "Owner");
  if (ownerTab) {
    ownerTab.insertAdjacentElement(
      "afterend",
      makeInfoIcon(
        "The owner is the account that controls this object at a high level. Owners often have the ability to view or change permissions even when other users cannot."
      )
    );
  }
}

function showExplanationPopup(text, x, y) {
  let popup = document.getElementById("feature-explanation-popup");

  if (!popup) {
    popup = document.createElement("div");
    popup.id = "feature-explanation-popup";
    popup.style.position = "absolute";
    popup.style.maxWidth = "320px";
    popup.style.padding = "12px";
    popup.style.background = "white";
    popup.style.border = "1px solid #666";
    popup.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    popup.style.zIndex = "9999";
    popup.style.lineHeight = "1.4";
    popup.style.borderRadius = "6px";
    document.body.appendChild(popup);
  }

  popup.textContent = text;
  popup.style.left = x + "px";
  popup.style.top = y + "px";
  popup.style.display = "block";
}

document.addEventListener("click", function(e) {
  const popup = document.getElementById("feature-explanation-popup");
  if (popup && !e.target.classList.contains("feature-info-icon")) {
    popup.style.display = "none";
  }
});

window.addEventListener("load", function() {
  addExplanationIcons();
});
