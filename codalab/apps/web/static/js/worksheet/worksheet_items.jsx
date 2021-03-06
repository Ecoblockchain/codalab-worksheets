
/*
Displays the list of items on the worksheet page.
A worksheet item is an interpreted items (either a contiguous block of markup
or a table, record, image, contents).  Note: different from worksheet item in
the bundle service.
*/

var WorksheetItemList = React.createClass({
    getInitialState: function() {
        return {
          updatingBundleUuids: {},
          isUpdatingBundles: false,
        };
    },

    componentDidUpdate: function() {
        var info = this.props.ws.info;
        if (!info || !info.items.length) {
            $('.empty-worksheet').fadeIn('fast');
        }
        if (this.state.editMode) {
            $('#raw-textarea').trigger('focus');
        }
    },

    capture_keys: function() {
        if (!this.props.active)  // If we're not the active component, don't bind keys
            return;

        // Open a new window (really should be handled at the item level)
        Mousetrap.bind(['enter'], function() {
            if (this.props.focusIndex < 0) return;
            var url = this.refs['item' + this.props.focusIndex].props.url;
            if (url)
              window.open(url, '_blank');
        }.bind(this), 'keydown');

        // Move focus up one
        Mousetrap.bind(['up', 'k'], function() {
            this.props.setFocus(this.props.focusIndex - 1, 'end');
        }.bind(this), 'keydown');

        // Move focus to the top
        Mousetrap.bind(['g g'], function() {
            $('body').stop(true).animate({scrollTop: 0}, 'fast');
            this.props.setFocus(-1, 0);
        }.bind(this), 'keydown');

        // Move focus down one
        Mousetrap.bind(['down', 'j'], function() {
            this.props.setFocus(this.props.focusIndex + 1, 0);
        }.bind(this), 'keydown');

        // Move focus to the bottom
        Mousetrap.bind(['shift+g'], function() {
            this.props.setFocus(this.props.ws.info.items.length - 1, 'end');
            $('html, body').animate({scrollTop: $(document).height()}, 'fast');
        }.bind(this), 'keydown');
    },

    // updateRunBundles fetch all the "unfinished" bundles in the worksheet, and recursively call itself until all the bundles in the worksheet are finished.
    updateRunBundles: function(worksheetUuid, numTrials, updatingBundleUuids) {
      var bundleUuids = updatingBundleUuids ? updatingBundleUuids : this.state.updatingBundleUuids;
      var startTime = new Date().getTime();
      var self = this;
      var queryParams = Object.keys(bundleUuids).map(function(bundle_uuid) {
        return 'bundle_uuid=' + bundle_uuid;
      }).join('&');
      $.ajax({
        type: "GET",
        url: "/rest/api/worksheets/" + worksheetUuid + "/?" + queryParams,
        dataType: 'json',
        cache: false,
        success: function(worksheet_content) {
          if (this.state.isUpdatingBundles) {
            if (worksheet_content.items) {
              self.props.refreshWorksheet(worksheet_content.items);
            }
            var endTime = new Date().getTime();
            var guaranteedDelayTime = Math.min(3000, numTrials * 1000);
            // Since we don't want to flood the server with too many requests, we enforce a guaranteedDelayTime.
            // guaranteedDelayTime is usually 3 seconds, except that we make the first two delays 1 second and 2 seconds respectively in case of really quick jobs.
            // delayTime is also at least five times the amount of time it takes for the last request to complete
            var delayTime = Math.max(guaranteedDelayTime, (endTime - startTime) * 5);
            setTimeout(function() {
              self.updateRunBundles(worksheetUuid, numTrials + 1);
            }, delayTime);
            startTime = endTime;
          }
        }.bind(this),
        error: function(xhr, status, err) {
          $("#worksheet-message").html(xhr.responseText).addClass('alert-danger alert');
          $('#worksheet_container').hide();
        }.bind(this)
      });
    },

    // Everytime the worksheet is updated, checkRunBundle will loop through all the bundles and find the "unfinished" ones (not ready or failed).
    // If there are unfinished bundles and we are not updating bundles now, call updateRunBundles, which will recursively call itself until all the bundles in the worksheet are finished.
    // this.state.updatingBundleUuids keeps track of the "unfinished" bundles in the worksheet at every moment.
    checkRunBundle: function(nextProps) {
      var info = nextProps.ws.info;
      var updatingBundleUuids = _.clone(this.state.updatingBundleUuids);
      if (info && info.items.length > 0) {
        var items = info.items;
        for (var i = 0; i < items.length; i++) {
          var bundle_info = items[i].bundle_info;
          if (bundle_info) {
            if (!Array.isArray(bundle_info)) bundle_info = [bundle_info];
            for (var j = 0; j < bundle_info.length; j++) {
              var bundle = bundle_info[j];
              if (bundle.bundle_type === 'run') {
                if (bundle.state !== 'ready' && bundle.state !== 'failed') {
                  updatingBundleUuids[bundle.uuid] = true;
                } else {
                  if (bundle.uuid in updatingBundleUuids)
                    delete updatingBundleUuids[bundle.uuid];
                }
              }
            }
          }
        }
        if (Object.keys(updatingBundleUuids).length > 0 && !this.state.isUpdatingBundles) {
          this.setState({isUpdatingBundles: true});
          this.updateRunBundles(info.uuid, 1, updatingBundleUuids);
        } else if (Object.keys(updatingBundleUuids).length === 0 && this.state.isUpdatingBundles) {
          this.setState({isUpdatingBundles: false});
        }
        this.setState({updatingBundleUuids: updatingBundleUuids});
      }
    },

    componentWillReceiveProps: function(nextProps) {
      this.checkRunBundle(nextProps);
    },

    bundleUuidToIndex: function() {
      // bundle uuid -> an array of [index, subIndex], corresponding to positions where the bundle occurs
      // E.g. 0x47bda9 -> [[0, 1], [2, 3]], which means bundle 0x47bda9 appears twice in the current worksheet
      var uuidToIndex = {};
      var info = this.props.ws.info;
      if (info && info.items.length > 0) {
        var items = info.items;
        for (var index = 0; index < items.length; index++) {
          var bundle_info = this.props.ensureIsArray(items[index].bundle_info);
          if (bundle_info) {
            for (var subIndex = 0; subIndex < bundle_info.length; subIndex++) {
              var bundle = bundle_info[subIndex];
              if (!(bundle.uuid in uuidToIndex))
                uuidToIndex[bundle.uuid] = [];
              uuidToIndex[bundle.uuid].push([index, subIndex]);
            }
          }
        }
      }
      return uuidToIndex;
    },

    handleContextMenuSelection: function(uuid, focusIndex, subFocusIndex, option) {
      var type = option[0]
      var args = option[1];
      args.push(uuid);
      if (type === ContextMenuEnum.command.ADD_BUNDLE_TO_HOMEWORKSHEET) {
        args.push('/');
      } else if (type === ContextMenuEnum.command.DETACH_BUNDLE) {
        var uuidToIndex = this.bundleUuidToIndex();
        if (uuidToIndex[uuid].length > 1) {
          // if a bundle appears more than once in the current worksheet
          for (var i = uuidToIndex[uuid].length - 1; i >= 0; i--) {
            var indices = uuidToIndex[uuid][i];
            if (indices[0] === focusIndex && indices[1] === subFocusIndex)
              break;
          }
          // index counting from the end
          args.push('-n', uuidToIndex[uuid].length - i)
        }
      }
      $('#command_line').terminal().exec(buildTerminalCommand(args));
    },

    handleContextMenu: function(uuid, focusIndex, subFocusIndex, isRunBundle, e) {
      e.preventDefault();
      this.props.setFocus(focusIndex, subFocusIndex, false);
      var bundleType = isRunBundle ? ContextMenuEnum.type.RUN : ContextMenuEnum.type.BUNDLE;
      ContextMenuMixin.openContextMenu(bundleType, this.handleContextMenuSelection.bind(undefined, uuid, focusIndex, subFocusIndex));
    },

    render: function() {
        this.capture_keys(); // each item capture keys are handled dynamically after this call

        // Create items
        var items_display;
        var info = this.props.ws.info;
        if (info && info.items.length > 0) {
            var worksheet_items = [];
            info.items.forEach(function(item, index) {
                var focused = (index == this.props.focusIndex);
                var props = {
                  item: item,
                  version: this.props.version,
                  active: this.props.active,
                  focused: focused,
                  canEdit: this.props.canEdit,
                  focusIndex: index,
                  subFocusIndex: focused ? this.props.subFocusIndex : null,
                  setFocus: this.props.setFocus,
                  focusActionBar: this.props.focusActionBar,
                  openWorksheet: this.props.openWorksheet,
                  handleContextMenu: this.handleContextMenu
                };
                addWorksheetItems(props, worksheet_items);
            }.bind(this));
            items_display = worksheet_items;
        } else {
          items_display = <p className="empty-worksheet">(empty)</p>;
        }
        if (info && info.error)
          items_display = <p className="alert-danger">Error in worksheet: {info.error}</p>;
        return <div id="worksheet_items">{items_display}</div>;
    }
});

////////////////////////////////////////////////////////////

// Create a worksheet item based on props and add it to worksheet_items.
// - item: information about the table to display
// - index: integer representing the index in the list of items
// - focused: whether this item has the focus
// - canEdit: whether we're allowed to edit this item
// - setFocus: call back to select this item
// - updateWorksheetSubFocusIndex: call back to notify parent of which row is selected (for tables)
var addWorksheetItems = function(props, worksheet_items) {
    var item = props.item;

    // Unpack search item into a table.
    if (item.mode == 'search') {
      var subitem = item.interpreted.items[0];
      if (!subitem) {
        subitem = {'interpreted': '(no results)', 'mode': 'markup'};
        //console.error('Invalid item', item);
      }
      var subprops = {};
      for (var k in props) subprops[k] = props[k];
      subprops.item = subitem;
      subprops.focusIndex = props.focusIndex;
      addWorksheetItems(subprops, worksheet_items);
      return;
    }

    // Determine URL corresponding to item.
    var url = null;
    if (item.bundle_info && item.bundle_info.uuid)
      url = '/bundles/' + item.bundle_info.uuid;
    if (item.subworksheet_info)
      url = '/worksheets/' + item.subworksheet_info.uuid;

    props.key = props.ref = 'item' + props.focusIndex;
    props.url = url;

    var constructor = {
      'markup': MarkdownItem,
      'table': TableItem,
      'contents': ContentsItem,
      'worksheet': WorksheetItem,
      'wsearch': WorksheetItem,
      'html': HTMLItem,
      'record': RecordItem,
      'image': ImageItem,
      'graph': GraphItem,
    }[item.mode];

    var elem;
    if (constructor) {
      elem = React.createElement(constructor, props);
    } else {
      elem = (
          <div>
              <strong>
                  Internal error: {item.mode}
              </strong>
          </div>
      );
    }
    worksheet_items.push(elem);
};
