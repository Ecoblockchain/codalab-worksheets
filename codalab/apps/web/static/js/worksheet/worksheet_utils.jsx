function render_permissions(state) {
  // Render permissions:
  // - state.permission_str (what user has)
  // - state.group_permissions (what other people have)
  var permission_str = 'you(' + (state.permission_str || '?') + ')';
  permission_str += (state.group_permissions || []).map(function(perm) {
    return ' ' + perm.group_name + "(" + perm.permission_str + ")";
  }).join('');
  permission_str;
  return permission_str;
}

function shorten_uuid(uuid) {
  return uuid.slice(0, 8);
}

function keepPosInView(pos) {
  var navbarHeight = parseInt($('body').css('padding-top'));
  var viewportHeight = Math.max($(".ws-container").innerHeight() || 0);

  // How far is the pos from top of viewport?
  var distanceFromTopViewPort = pos - navbarHeight;

  if (distanceFromTopViewPort < 0 || distanceFromTopViewPort > viewportHeight * 0.8) {
    // If pos is off the top of the screen or it is more than 80% down the screen,
    // then scroll so that it is at 25% down the screen.
    // Where is the top of the element on the page and does it fit in the
    // the upper fourth of the page?
    var scrollTo = $(".ws-container").scrollTop() + pos - navbarHeight - (viewportHeight * 0.25);
    $(".ws-container").stop(true).animate({scrollTop: scrollTo}, 50);
  }
}

// Whether an interpreted item changed - used in shouldComponentUpdate.
function worksheetItemPropsChanged(props, nextProps) {
  /*console.log('worksheetItemPropsChanged',
      props.active != nextProps.active,
      props.focused != nextProps.focused,
      props.subFocusIndex != nextProps.subFocusIndex,
      props.version != nextProps.version);*/
  return props.active != nextProps.active ||
         props.focused != nextProps.focused ||
         (nextProps.focused && props.subFocusIndex != nextProps.subFocusIndex) ||
         props.version != nextProps.version;
}

// given an array of arguments, return a shell-safe command
function buildTerminalCommand(args) {
  var ret = [];
  args.forEach(function(s) {
    if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
      s = "'"+s.replace(/'/g,"'\\''") + "'";
      s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
           .replace(/\\'''/g, "\\'" ); // remove non-escaped single-quote if there are enclosed between 2 escaped
    }
    ret.push(s);
  });
  return ret.join(' ');
}
