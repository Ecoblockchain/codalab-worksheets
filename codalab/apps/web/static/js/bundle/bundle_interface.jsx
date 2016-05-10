/*
Stand-alone bundle details interface.
 */
var Bundle = React.createClass({
    getInitialState: function(){
        return {
            "data_hash": "",
            "uuid": "",
            "hard_dependencies": [],
            "state": "ready",
            "dependencies": [],
            "host_worksheets": [],
            "group_permissions": [],
            "command": null,
            "bundle_type": "",
            "metadata": {},
            "files": {},
            "fileBrowserData": "",
            "currentWorkingDirectory": "",
            "editing": false,
            "permission": 0,
            "permission_spec": ''
        };
    },
    toggleEditing: function(){
        this.setState({editing: !this.state.editing});
    },
    saveMetadata: function(){
        var new_metadata = this.state.metadata;
        $('#metadata_table input').each(function(){
            var key = $(this).attr('name');
            var val = $(this).val();
            if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
                // Convert string 'true'/'false' to boolean true/false
                val = (val.toLowerCase() === 'true');
            }
            if (new_metadata[key].constructor === Array) {
                // Convert string comma-separated list to Array
                val = val.split(',');
            }
            if (val != new_metadata[key]) {
                new_metadata[key] = val;
            }
        });

        console.log('------ save the bundle here ------');
        console.log('new metadata:');
        console.log(new_metadata);
        var postdata = {
            data: {
                id: this.state.uuid,
                type: 'bundles',
                attributes: {
                    bundle_type: this.state.bundle_type,
                    metadata: new_metadata
                }
            }
        };

        $.ajax({
            type: "PATCH",
            cache: false,
            //  /rest/bundles/0x706<...>d5b66e
            url: "/rest/bundles/" + this.state.uuid,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data: JSON.stringify(postdata),
            headers: {
                'X-HTTP-Method-Override': 'PATCH'
            },
            xhr: function() {
                // Hack for IE < 9 to use PATCH method
                return window.XMLHttpRequest == null || new window.XMLHttpRequest().addEventListener == null
                  ? new window.ActiveXObject("Microsoft.XMLHTTP")
                  : $.ajaxSettings.xhr();
            },
            success: function(data) {
                this.setState(data);
                this.setState({
                     editing: false,
                });
                $("#bundle-message").hide().removeClass('alert-danger alert');
            }.bind(this),
            error: function(xhr, status, err) {
                $("#bundle-message").text(xhr.responseText).addClass('alert-danger alert');
                $("#bundle-message").show();
            }.bind(this)
        });
    },
    componentWillMount: function() {  // once on the page lets get the bundle info
        var uuid = window.location.pathname.split('/')[2];
        $.ajax({
            type: "GET",
            //  /rest/bundles/0x706<...>d5b66e
            url: "/rest/bundles/" + uuid,
            data: {
                include: 'users,bundle-permissions'
            },
            dataType: 'json',
            cache: false,
            success: function(data) {
                // Use ephemeral JsonApiDataStore to wire up relationships
                var store = new JsonApiDataStore();
                if (this.isMounted()) {
                    this.setState(store.sync(data));
                }
                $("#bundle-message").hide().removeClass('alert-danger alert');
            }.bind(this),
            error: function(xhr, status, err) {
                $("#bundle-message")
                    .html(xhr.responseText)
                    .addClass('alert-danger alert');
                $("#bundle-message").show();
                $('#bundle-content').hide();
            }.bind(this)
        });

        this.updateFileBrowser();
    },

    // File browser is updated based on location.hash!
    updateFileBrowser: function(specific_folder_path, reset_cwd) {
        var folder_path = specific_folder_path || '';

        // Special case '..' we go up a directory
        if(folder_path == '..') {
            // Remove the last directory
            dirs = this.state.currentWorkingDirectory.split('/');
            dirs.pop();
            folder_path = dirs.join('/');
            // Remove last '/'
            if(folder_path.substr(-1) == '/') {
                return folder_path.substr(0, folder_path.length - 1);
            }

            reset_cwd = true;
        }

        if(reset_cwd) {
            this.setState({"currentWorkingDirectory": folder_path});
        } else {
            if (this.state.currentWorkingDirectory != '') {
                folder_path = this.state.currentWorkingDirectory + "/" + folder_path;
                this.setState({"currentWorkingDirectory": folder_path});
            } else {
                this.setState({"currentWorkingDirectory": folder_path});
            }
        }

        var uuid = window.location.pathname.split('/')[2];

        $.ajax({
            type: "GET",
            //  /rest/bundles/0x706<...>d5b66e/contents/info/<path>
            url: '/rest/bundles/' + uuid + '/contents/info/' + folder_path + '/', //extra slash at end means root dir
            data: {
                depth: 1
            },
            dataType: 'json',
            cache: false,
            success: function(response) {
                this.setState({"fileBrowserData": response.data});
            }.bind(this),
            error: function(xhr, status, err) {
                $("#bundle-message").html(xhr.responseText).addClass('alert-danger alert');
                $("#bundle-message").show();
                $('.bundle-file-view-container').hide();
            }.bind(this)
        });
    },

    render: function() {
        var saveButton;
        var metadata = this.state.metadata;
        // TODO(sckoo): point at pluralized root when updated
        var bundle_download_url = "/rest/bundle/" + this.state.uuid + "/contents/blob/";
        var bundleAttrs = [];
        var editing = this.state.editing;
        var tableClassName = 'table' + (editing ? ' editing' : '');
        var editButtonText = editing ? 'cancel' : 'edit';

        if (editing)
            saveButton = <button className="btn btn-success btn-sm" onClick={this.saveMetadata}>save</button>;

        var keys = [];
        for (var property in metadata) {
            if (metadata.hasOwnProperty(property))
                keys.push(property);
        }
        keys.sort();
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            // TODO: only allow editing on certain keys; needs to be passed in from Python.
            bundleAttrs.push(<BundleAttr key={k} index={k} val={metadata[k]} editing={editing} />);
        }

        var dependencies_table = [];
        if (this.state.dependencies.length) {
            this.state.dependencies.forEach(function(dep, i) {
                var dep_bundle_url = "/bundles/" + dep.parent_uuid;
                dependencies_table.push(
                    <tr>
                        <td>
                            {dep.child_path}
                        </td>
                        <td>
                            {dep.parent_name}(<a href={dep_bundle_url}>{dep.parent_uuid}</a>){dep.parent_path ? '/' + dep.parent_path : ''}
                        </td>
                    </tr>
                );
            }) // end of foreach

            var dependencies_html = (
                <div className="row">
                    <div className="col-sm-10">
                        <div className="dependencies-table">
                            <table id="dependencies_table" >
                                <thead>
                                    <tr>
                                        <th>Path</th>
                                        <th>Target</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dependencies_table}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        var stdout_html = '';
        if(this.state.stdout) {
            //had to add span since react elm must be wrapped
            stdout_html = (
                <span>
                    <h3>Stdout</h3>
                    <div className="bundle-meta">
                        <pre>
                            {this.state.stdout}
                        </pre>
                    </div>
                </span>
            );
        }
        var stderr_html = '';
        if(this.state.stderr) {
            //had to add span since react elm must be wrapped
            stderr_html = (
                <span>
                    <h3>Stderr</h3>
                    <div className="bundle-meta">
                        <pre>
                            {this.state.stderr}
                        </pre>
                    </div>
                </span>
            );
        }
        /// ------------------------------------------------------------------
        var fileBrowser = (
                <FileBrowser
                    fileBrowserData={this.state.fileBrowserData}
                    updateFileBrowser={this.updateFileBrowser}
                    currentWorkingDirectory={this.state.currentWorkingDirectory} />
            );

        /// ------------------------------------------------------------------
        var edit = ''
        if(this.state.permission >= 2){
            edit = (
                <button className="btn btn-primary btn-sm" onClick={this.toggleEditing}>
                    {editButtonText}
                </button>
            )
        }
        /// ------------------------------------------------------------------
        var host_worksheets_html = ''
        if(this.state.host_worksheets.length){
            var host_worksheets_url = ''
            host_worksheets_rows = []
            this.state.host_worksheets.forEach(function(worksheet, i){
                host_worksheets_url = "/worksheets/" + worksheet.uuid;
                host_worksheets_rows.push(
                    <tr>
                        <td>
                            {worksheet.name}
                        </td>
                        <td>
                            <a href={host_worksheets_url}>{worksheet.uuid}</a>
                        </td>
                    </tr>
                );
            }) // end of foreach
            host_worksheets_html = (
                        <div className="row">
                            <div className="col-sm-10">
                                <div className="dependencies-table">
                                    <table id="dependencies_table" >
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>UUID</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {host_worksheets_rows}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
            )
        }

        return (
            <div className="bundle-tile">
                <div className="bundle-header">
                    <div className="row">
                        <div className="col-sm-6">
                            <h2 className="bundle-name bundle-icon-sm bundle-icon-sm-indent">
                                {this.state.metadata.name}
                            </h2>
                            <em> Owner: {this.state.owner ? this.state.owner.user_name : ''}</em>
                        </div>
                        <div className="col-sm-6">
                            <a href={bundle_download_url} className="bundle-download btn btn-default btn-sm" alt="Download Bundle">
                                Download <span className="glyphicon glyphicon-download-alt"></span>
                            </a>
                            <div className="bundle-uuid">{this.state.uuid}</div>
                        </div>
                    </div>
                </div>
                <p>
                    {this.state.metadata.description}
                </p>
                    <div className="metadata-table">
                        <table>
                            <tr>
                                <th width="33%">
                                    State
                                </th>
                                <td>
                                    {this.state.state}
                                </td>
                            </tr>
                            <tr>
                                <th width="33%">
                                    Command
                                </th>
                                <td>
                                    {this.state.command || "<none>"}
                                </td>
                            </tr>
                             <tr>
                                <th width="33%">
                                    Data Hash
                                </th>
                                <td>
                                    {this.state.data_hash || "<none>"}
                                </td>
                            </tr>
                        </table>
                    </div>

                {dependencies_html ? <h3> Dependencies</h3> : null}
                {dependencies_html ? dependencies_html : null}

                <div className="row">
                    <div className="col-sm-10">
                        {stdout_html}
                        {stderr_html}
                    </div>
                </div>

                <div className="bundle-file-view-container">
                    {this.state.fileBrowserData.contents ? fileBrowser : null}
                </div>

                <h3>
                    Metadata
                    {edit}
                    {saveButton}
                </h3>
                <div className="row">
                    <div className="col-sm-6">
                        <em>Permission: {this.state.permission_spec}</em>
                        <div className="metadata-table">
                            <table id="metadata_table" className={tableClassName}>
                                <tbody>
                                    {bundleAttrs}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {host_worksheets_html ? <h3>Host Worksheets</h3> : null}
                {host_worksheets_html ? host_worksheets_html : null}
            </div>
        );
    }
});

var BundleAttr = React.createClass({
    render: function(){
        var val = this.props.val;
        if (this.props.index !== 'description' && !this.props.editing) {
            val = (val.constructor === Array) ? val.join(', ') : val;
            return (
                <tr>
                    <th width="33%">
                        {this.props.index}
                    </th>
                    <td>
                        {val}
                    </td>
                </tr>
            );
        } else if (this.props.editing) {
            val = (val.constructor === Array) ? val.join(',') : val;
            return (
                <tr>
                    <th width="33%">
                        {this.props.index}
                    </th>
                    <td>
                        <input className="form-control" name={this.props.index} type="text" defaultValue={val} />
                    </td>
                </tr>
            )
        }else {
            return false;
        }
    }
});

var FileBrowser = React.createClass({
    render: function() {
        var items = [];
        var item; // so we have 1, see later
        var files;
        if(this.props.fileBrowserData.contents) {
            // .. special item, only on inside dirs (current directory not '')
            if(this.props.currentWorkingDirectory) {
                items.push(<FileBrowserItem key=".." index=".."type=".." updateFileBrowser={this.props.updateFileBrowser} currentWorkingDirectory={this.props.currentWorkingDirectory} />);
            }

            // One loop for folders so they are on the top of the list
            for (var i = 0; i < this.props.fileBrowserData.contents.length; i++) {
                item = this.props.fileBrowserData.contents[i];
                if (item.type == 'directory') {
                    items.push(<FileBrowserItem key={item.name} index={item.name} type={item.type} updateFileBrowser={this.props.updateFileBrowser} currentWorkingDirectory={this.props.currentWorkingDirectory}  />);
                }
            }

            // Next loop for files
            for (var i = 0; i < this.props.fileBrowserData.contents.length; i++) {
                item = this.props.fileBrowserData.contents[i];
                if (item.type != 'directory') {
                    items.push(<FileBrowserItem key={item.name} index={item.name} type={item.type} size={item.size} link={item.link} updateFileBrowser={this.props.updateFileBrowser} currentWorkingDirectory={this.props.currentWorkingDirectory}  />);
                }
            }

            file_browser = (
                <table className="file-browser-table">
                    <tbody>
                        {items}
                    </tbody>
                </table>
                );
        } else {
            file_browser = (<b>No files found</b>);
        }

        var bread_crumbs = (<FileBrowserBreadCrumbs updateFileBrowser={this.props.updateFileBrowser} currentWorkingDirectory={this.props.currentWorkingDirectory} />);
        return (
            <div>
                <h3>File Browser</h3>
                <div className="panel panel-default">
                    {bread_crumbs.props.currentWorkingDirectory.length ? bread_crumbs : null}
                    <div className="panel-body">
                        {file_browser}
                    </div>
                </div>
            </div>
            );
    }
});



var FileBrowserBreadCrumbs = React.createClass({
    breadCrumbClicked: function(path) {
        this.props.updateFileBrowser(path, true);
        console.log("breadcrumb -> "+path);
    },
    render: function() {
        var links = [];
        var splitDirs = this.props.currentWorkingDirectory.split('/');
        var currentDirectory = '';

        // Generate list of breadcrumbs separated by ' / '
        for(var i=0; i < splitDirs.length; i++) {
            if(i == 0) {
                currentDirectory += splitDirs[i];
            } else {
                currentDirectory += "/" + splitDirs[i];
            }
            links.push(<span key={splitDirs[i]} index={splitDirs[i]} onClick={this.breadCrumbClicked.bind(null, currentDirectory)}> / {splitDirs[i]}</span>);
        }

        return (
            <div className="panel-heading">{links}</div>
        );
    }
});

var FileBrowserItem = React.createClass({
    browseToFolder: function(type) {
        this.props.updateFileBrowser(this.props.index);
    },
    render: function() {
        var size = '';
        if(this.props.hasOwnProperty('size')){
            if(this.props.size == 0 || this.props.size === undefined)
                size = "0 bytes"
            else{ // we have a real size create a nice human readable version
                var k = 1000;
                var sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
                var i = Math.floor(Math.log(this.props.size) / Math.log(k));
                size = (this.props.size / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
            }
        }

        if (this.props.type == 'directory' || this.props.type == '..') {
            item = (
              <div className={this.props.type} onClick={this.browseToFolder}>
                  <span className="glyphicon-folder-open glyphicon" alt="More"></span>
                  <a target="_blank">{this.props.index}</a>
                  <span className="pull-right">{size}</span>
              </div>
            );
        } else if (this.props.type == 'file') {
            var file_location = '';
            if (this.props.currentWorkingDirectory) {
                file_location = this.props.currentWorkingDirectory + '/' + this.props.index;
            } else {
                file_location = this.props.index;
            }
            var file_link = document.location.pathname.replace('/bundles/', '/rest/bundle/') + 'contents/blob/' + encodeURIComponent(file_location);
            item = (
              <div className={this.props.type}>
                  <span className="glyphicon-file glyphicon" alt="More"></span>
                  <a href={file_link} target="_blank">{this.props.index}</a>
                  <span className="pull-right">{size}</span>
              </div>
            );
        } else if (this.props.type == 'link') {
            item = (
              <div className={this.props.type}>
                  <span className="glyphicon-file glyphicon" alt="More"></span>
                  {this.props.index + ' -> ' + this.props.link}
              </div>
            );
        }
        
        return (
          <tr>
            <td>
              {item}
            </td>
          </tr>
        )
    }
});

React.render(<Bundle />, document.getElementById('bundle-content'));
