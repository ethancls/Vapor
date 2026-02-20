# Multipass CLI Reference

Generated on: 2026-02-19 23:53:00 UTC

## Version

```text
multipass   1.16.1
multipassd  1.16.1
```

## Global Help

```text
Usage: multipass [options] <command>
Create, control and connect to Ubuntu instances.

This is a command line utility for multipass, a
service that manages Ubuntu instances.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.

Available commands:
  alias         Create an alias
  aliases       List available aliases
  authenticate  Authenticate client
  clone         Clone an instance
  delete        Delete instances and snapshots
  exec          Run a command on an instance
  find          Display available images to create instances from
  get           Get a configuration setting
  help          Display help about a command
  info          Display information about instances or snapshots
  launch        Create and start an Ubuntu instance
  list          List all available instances or snapshots
  mount         Mount a local directory in the instance
  networks      List available network interfaces
  prefer        Switch the current alias context
  purge         Purge all deleted instances permanently
  recover       Recover deleted instances
  restart       Restart instances
  restore       Restore an instance from a snapshot
  set           Set a configuration setting
  shell         Open a shell on an instance
  snapshot      Take a snapshot of an instance
  start         Start instances
  stop          Stop running instances
  suspend       Suspend running instances
  transfer      Transfer files between the host and instances
  umount        Unmount a directory from an instance
  unalias       Remove aliases
  version       Show version details
```

## Commands

- `alias`
- `aliases`
- `authenticate`
- `clone`
- `delete`
- `exec`
- `find`
- `get`
- `help`
- `info`
- `launch`
- `list`
- `mount`
- `networks`
- `prefer`
- `purge`
- `recover`
- `restart`
- `restore`
- `set`
- `shell`
- `snapshot`
- `start`
- `stop`
- `suspend`
- `transfer`
- `umount`
- `unalias`
- `version`

## `alias`

```text
Usage: multipass alias [options] <definition> [<name>]
Create an alias to be executed on a given instance.

Options:
  -h, --help                      Displays help on commandline options
  -v, --verbose                   Increase logging verbosity. Repeat the 'v' in
                                  the short option for more detail. Maximum
                                  verbosity is obtained with 4 (or more) v's,
                                  i.e. -vvvv.
  -n, --no-map-working-directory  Do not automatically map the host execution
                                  path to a mounted path

Arguments:
  definition                      Alias definition in the form
                                  <instance>:<command>
  name                            Name given to the alias being defined,
                                  defaults to <command>
```

## `aliases`

```text
Usage: multipass aliases [options]
List available aliases

Options:
  -h, --help         Displays help on commandline options
  -v, --verbose      Increase logging verbosity. Repeat the 'v' in the short
                     option for more detail. Maximum verbosity is obtained with
                     4 (or more) v's, i.e. -vvvv.
  --format <format>  Output list in the requested format. Valid formats are:
                     table (default), json, csv and yaml. The output working
                     directory states whether the alias runs in the instance's
                     default directory or the alias running directory should try
                     to be mapped to a mounted one.

```

## `authenticate`

```text
Usage: multipass authenticate [options] [<passphrase>]
Authenticate with the Multipass service.
A system administrator should provide you with a passphrase
to allow use of the Multipass service.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.

Arguments:
  passphrase     Passphrase to register with the Multipass service. If omitted,
                 a prompt will be displayed for entering the passphrase.
```

## `clone`

```text
Usage: multipass clone [options] <source_name>
Create an independent copy of an existing (stopped) instance.

Options:
  -h, --help                     Displays help on commandline options
  -v, --verbose                  Increase logging verbosity. Repeat the 'v' in
                                 the short option for more detail. Maximum
                                 verbosity is obtained with 4 (or more) v's,
                                 i.e. -vvvv.
  -n, --name <destination-name>  An optional custom name for the cloned
                                 instance. The name must follow the usual
                                 validity rules (see "help launch"). Default:
                                 "<source_name>-cloneN", where N is the Nth
                                 cloned instance.

Arguments:
  source_name                    The name of the source instance to be cloned
```

## `delete`

```text
Usage: multipass delete [options] <instance>[.snapshot] [<instance>[.snapshot] ...]
Delete instances and snapshots (in stopped instances). Instances can be purged immediately or later on,
with the "purge" command. Until they are purged, instances can be recovered
with the "recover" command. Snapshots cannot be recovered after deletion and must be purged at once.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.
  --all          Delete all instances and snapshots
  -p, --purge    Permanently delete specified instances and snapshots
                 immediately

Arguments:
  name           Names of instances and snapshots to delete
```

## `exec`

```text
Usage: multipass exec [options] <name> [--] <command>
Run a command on an instance

Options:
  -h, --help                      Displays help on commandline options
  -v, --verbose                   Increase logging verbosity. Repeat the 'v' in
                                  the short option for more detail. Maximum
                                  verbosity is obtained with 4 (or more) v's,
                                  i.e. -vvvv.
  -d, --working-directory <dir>   Change to <dir> before execution
  -n, --no-map-working-directory  Do not map the host execution path to a
                                  mounted path

Arguments:
  name                            Name of instance to execute the command on
  command                         Command to execute on the instance
```

## `find`

```text
Usage: multipass find [options] [<remote:>][<string>]
Lists available images matching <string> for creating instances from.
With no search string, lists all aliases for supported Ubuntu releases.

Options:
  -h, --help          Displays help on commandline options
  -v, --verbose       Increase logging verbosity. Repeat the 'v' in the short
                      option for more detail. Maximum verbosity is obtained with
                      4 (or more) v's, i.e. -vvvv.
  --show-unsupported  Show unsupported cloud images as well
  --only-images       Show only images
  --only-blueprints   Show only blueprints
  --format <format>   Output list in the requested format.
                      Valid formats are: table (default), json, csv and yaml
  --force-update      Force the image information to update from the network

Arguments:
  string              An optional value to search for in [<remote:>]<string>
                      format, where <remote> can be either ‘release’ or ‘daily’.
                      If <remote> is omitted, it will search ‘release‘ first,
                      and if no matches are found, it will then search ‘daily‘.
                      <string> can be a partial image hash or an Ubuntu release
                      version, codename or alias.
```

## `get`

```text
Usage: multipass get [options] [<arg>]
Get the configuration setting corresponding to the given key, or all settings if no key is specified.
(Support for multiple keys and wildcards coming...)

Some common settings keys are:
  - client.primary-name
  - local.driver
  - local.privileged-mounts

Use `multipass get --keys` to obtain the full list of available settings at any given time.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.
  --raw          Output in raw format. For now, this affects only the
                 representation of empty values (i.e. "" instead of "<empty>").
  --keys         List available settings keys. This outputs the whole list of
                 currently available settings keys, or just <arg>, if provided
                 and a valid key.

Arguments:
  arg            Setting key, i.e. path to the intended setting.
```

## `help`

```text
Usage: multipass help [options] <command>
Displays help for the given command.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.

Arguments:
  command        Name of command to display help for
```

## `info`

```text
Usage: multipass info [options] <instance>[.snapshot] [<instance>[.snapshot] ...]
Display information about instances or snapshots

Options:
  -h, --help         Displays help on commandline options
  -v, --verbose      Increase logging verbosity. Repeat the 'v' in the short
                     option for more detail. Maximum verbosity is obtained with
                     4 (or more) v's, i.e. -vvvv.
  --snapshots        Display detailed information about the snapshots of
                     specified instances. This option has no effect on snapshot
                     arguments. Omit instance/snapshot arguments to obtain
                     detailed information on all the snapshots of all instances.
  --format <format>  Output info in the requested format.
                     Valid formats are: table (default), json, csv and yaml.

Arguments:
  instance/snapshot  Names of instances or snapshots to display information
                     about
```

## `launch`

```text
Usage: multipass launch [options] [[<remote:>]<image> | <url>]
Create and start a new instance.

Options:
  -h, --help                   Displays help on commandline options
  -v, --verbose                Increase logging verbosity. Repeat the 'v' in
                               the short option for more detail. Maximum
                               verbosity is obtained with 4 (or more) v's, i.e.
                               -vvvv.
  -c, --cpus <cpus>            Number of CPUs to allocate.
                               Minimum: 1, default: 1.
  -d, --disk <disk>            Disk space to allocate. Positive integers, in
                               bytes, or decimals, with K, M, G suffix.
                               Minimum: 512M, default: 5G.
  -m, --memory <memory>        Amount of memory to allocate. Positive integers,
                               in bytes, or decimals, with K, M, G suffix.
                               Minimum: 128M, default: 1G.
  -n, --name <name>            Name for the instance. If it is 'primary' (the
                               configured primary instance name), the user's
                               home directory is mounted inside the newly
                               launched instance, in 'Home'.
                               Valid names must consist of letters, numbers, or
                               hyphens, must start with a letter, and must end
                               with an alphanumeric character.
  --cloud-init <file> | <url>  Path or URL to a user-data cloud-init
                               configuration, or '-' for stdin.
  --network <spec>             Add a network interface to the instance, where
                               <spec> is in the "key=value,key=value" format,
                               with the following keys available:
                                name: the network to connect to (required), use
                               the networks command for a list of possible
                               values, or use 'bridged' to use the interface
                               configured via `multipass set
                               local.bridged-network`.
                                mode: auto|manual (default: auto)
                                mac: hardware address (default: random).
                               You can also use a shortcut of "<name>" to mean
                               "name=<name>".
  --bridged                    Adds one `--network bridged` network.
  --mount <source>:<target>    Mount a local directory inside the instance. If
                               <target> is omitted, the mount point will be
                               under /home/ubuntu/<source-dir>, where
                               <source-dir> is the name of the <source>
                               directory.
  --timeout <timeout>          Maximum time, in seconds, to wait for the
                               command to complete. Note that some background
                               operations may continue beyond that. By default,
                               instance startup and initialization is limited to
                               5 minutes each.

Arguments:
  image                        Optional image to launch. If omitted, then the
                               default Ubuntu LTS will be used.
                               <remote> can be either ‘release’ or ‘daily‘. If
                               <remote> is omitted, ‘release’ will be used.
                               <image> can be a partial image hash or an Ubuntu
                               release version, codename or alias.
                               <url> is a custom image URL that is in http://,
                               https://, or file:// format.

```

## `list`

```text
Usage: multipass list [options]
List all instances or snapshots which have been created.

Options:
  -h, --help         Displays help on commandline options
  -v, --verbose      Increase logging verbosity. Repeat the 'v' in the short
                     option for more detail. Maximum verbosity is obtained with
                     4 (or more) v's, i.e. -vvvv.
  --snapshots        List all available snapshots
  --format <format>  Output list in the requested format.
                     Valid formats are: table (default), json, csv and yaml
```

## `mount`

```text
Usage: multipass mount [options] <source> <target> [<target> ...]
Mount a local directory inside the instance. If the instance is
not currently running, the directory will be mounted
automatically on next boot.

Options:
  -h, --help                       Displays help on commandline options
  -v, --verbose                    Increase logging verbosity. Repeat the 'v'
                                   in the short option for more detail. Maximum
                                   verbosity is obtained with 4 (or more) v's,
                                   i.e. -vvvv.
  -g, --gid-map <host>:<instance>  A mapping of group IDs for use in the mount.
                                   File and folder ownership will be mapped from
                                   <host> to <instance> inside the instance. Can
                                   be used multiple times. Mappings can only be
                                   specified as a one-to-one relationship.
  -u, --uid-map <host>:<instance>  A mapping of user IDs for use in the mount.
                                   File and folder ownership will be mapped from
                                   <host> to <instance> inside the instance. Can
                                   be used multiple times. Mappings can only be
                                   specified as a one-to-one relationship.
  -t, --type <type>                Specify the type of mount to use.
                                   Classic mounts use technology built into
                                   Multipass.
                                   Native mounts use hypervisor and/or platform
                                   specific mounts.
                                   Valid types are: 'classic' (default) and
                                   'native'

Arguments:
  source                           Path of the local directory to mount
  target                           Target mount points, in <name>[:<path>]
                                   format, where <name> is an instance name, and
                                   optional <path> is the mount point. If
                                   omitted, the mount point will be under
                                   /home/ubuntu/<source-dir>, where <source-dir>
                                   is the name of the <source> directory.
```

## `networks`

```text
Usage: multipass networks [options]
List host network devices (physical interfaces, virtual switches, bridges)
available to integrate with using the `--network` switch to the `launch`
command.

Options:
  -h, --help         Displays help on commandline options
  -v, --verbose      Increase logging verbosity. Repeat the 'v' in the short
                     option for more detail. Maximum verbosity is obtained with
                     4 (or more) v's, i.e. -vvvv.
  --format <format>  Output list in the requested format.
                     Valid formats are: table (default), json, csv and yaml
```

## `prefer`

```text
Usage: multipass prefer [options] <name>
Switch the current alias context. If it does not exist, create it before switching.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.

Arguments:
  name           Name of the context to switch to
```

## `purge`

```text
Usage: multipass purge [options]
Purge all deleted instances permanently, including all their data.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.
```

## `recover`

```text
Usage: multipass recover [options] <name> [<name> ...]
Recover deleted instances so they can be used again.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.
  --all          Recover all deleted instances

Arguments:
  name           Names of instances to recover
```

## `restart`

```text
Usage: multipass restart [options] [<name> ...]
Restart the named instances. Exits with return
code 0 when the instances restart, or with an
error code if any fail to restart.

Options:
  -h, --help           Displays help on commandline options
  -v, --verbose        Increase logging verbosity. Repeat the 'v' in the short
                       option for more detail. Maximum verbosity is obtained
                       with 4 (or more) v's, i.e. -vvvv.
  --all                Restart all instances
  --timeout <timeout>  Maximum time, in seconds, to wait for the command to
                       complete. Note that some background operations may
                       continue beyond that. By default, instance startup and
                       initialization is limited to 5 minutes each.

Arguments:
  name                 Names of instances to restart. If omitted, and without
                       the --all option, 'primary' will be assumed.
```

## `restore`

```text
Usage: multipass restore [options] <instance>.<snapshot>
Restore a stopped instance to the state of a previously taken snapshot.

Options:
  -h, --help         Displays help on commandline options
  -v, --verbose      Increase logging verbosity. Repeat the 'v' in the short
                     option for more detail. Maximum verbosity is obtained with
                     4 (or more) v's, i.e. -vvvv.
  -d, --destructive  Discard the current state of the instance

Arguments:
  instance.snapshot  The instance to restore and snapshot to use, in
                     <instance>.<snapshot> format, where <instance> is the name
                     of an instance, and <snapshot> is the name of a snapshot
```

## `set`

```text
Usage: multipass set [options] <key>[=<value>]
Set, to the given value, the configuration setting corresponding to the given key.

Some common settings keys are:
  - client.primary-name
  - local.driver
  - local.privileged-mounts

Use `multipass get --keys` to obtain the full list of available settings at any given time.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.

Arguments:
  keyval         A key, or a key-value pair. The key specifies a path to the
                 setting to configure. The value is its intended value. If only
                 the key is given, the value will be prompted for.
```

## `shell`

```text
Usage: multipass shell [options] [<name>]
Open a shell prompt on the instance. If the instance is not running, it will be started automatically.

Options:
  -h, --help           Displays help on commandline options
  -v, --verbose        Increase logging verbosity. Repeat the 'v' in the short
                       option for more detail. Maximum verbosity is obtained
                       with 4 (or more) v's, i.e. -vvvv.
  --timeout <timeout>  Maximum time, in seconds, to wait for the command to
                       complete. Note that some background operations may
                       continue beyond that. By default, instance startup and
                       initialization is limited to 5 minutes each.

Arguments:
  name                 Name of the instance to open a shell on. If omitted,
                       'primary' (the configured primary instance name) will be
                       assumed. If the instance is not running, an attempt is
                       made to start it (see `start` for more info).
```

## `snapshot`

```text
Usage: multipass snapshot [options] instance
Take a snapshot of a stopped instance that can later be restored to recover the current state.

Options:
  -h, --help                   Displays help on commandline options
  -v, --verbose                Increase logging verbosity. Repeat the 'v' in
                               the short option for more detail. Maximum
                               verbosity is obtained with 4 (or more) v's, i.e.
                               -vvvv.
  -n, --name <name>            An optional name for the snapshot, subject to
                               the same validity rules as instance names (see
                               `help launch`). Default: "snapshotN", where N is
                               one plus the number of snapshots that were ever
                               taken for <instance>.
  --comment, -c, -m <comment>  An optional free comment to associate with the
                               snapshot. (Hint: quote the text to avoid spaces
                               being parsed by your shell)

Arguments:
  instance                     The instance to take a snapshot of.
```

## `start`

```text
Usage: multipass start [options] [<name> ...]
Start the named instances. Exits with return code 0
when the instances start, or with an error code if
any fail to start.

Options:
  -h, --help           Displays help on commandline options
  -v, --verbose        Increase logging verbosity. Repeat the 'v' in the short
                       option for more detail. Maximum verbosity is obtained
                       with 4 (or more) v's, i.e. -vvvv.
  --all                Start all instances
  --timeout <timeout>  Maximum time, in seconds, to wait for the command to
                       complete. Note that some background operations may
                       continue beyond that. By default, instance startup and
                       initialization is limited to 5 minutes each.

Arguments:
  name                 Names of instances to start. If omitted, and without the
                       --all option, 'primary' (the configured primary instance
                       name) will be assumed. If 'primary' does not exist but is
                       included in a successful start command (either implicitly
                       or explicitly), it is launched automatically (see
                       `launch` for more info).
```

## `stop`

```text
Usage: multipass stop [options] [<name> ...]
Stop the named instances. Exits with return code 0 
if successful.

Options:
  -h, --help         Displays help on commandline options
  -v, --verbose      Increase logging verbosity. Repeat the 'v' in the short
                     option for more detail. Maximum verbosity is obtained with
                     4 (or more) v's, i.e. -vvvv.
  --all              Stop all instances
  -t, --time <time>  Time from now, in minutes, to delay shutdown of the
                     instance
  -c, --cancel       Cancel a pending delayed shutdown
  --force            Force the instance to shut down immediately. Warning: This
                     could potentially corrupt a running instance, so use with
                     caution.

Arguments:
  name               Names of instances to stop. If omitted, and without the
                     --all option, 'primary' will be assumed.
```

## `suspend`

```text
Usage: multipass suspend [options] [<name> ...]
Suspend the named instances, if running. Exits with
return code 0 if successful.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.
  --all          Suspend all instances

Arguments:
  name           Names of instances to suspend. If omitted, and without the
                 --all option, 'primary' will be assumed.
```

## `transfer`

```text
Usage: multipass transfer [options] <source> [<source> ...] <destination>
Copy files and directories between the host and instances.

Options:
  -h, --help       Displays help on commandline options
  -v, --verbose    Increase logging verbosity. Repeat the 'v' in the short
                   option for more detail. Maximum verbosity is obtained with 4
                   (or more) v's, i.e. -vvvv.
  -r, --recursive  Recursively copy entire directories
  -p, --parents    Make parent directories as needed

Arguments:
  source           One or more paths to transfer, prefixed with <name:> for
                   paths inside the instance, or '-' for stdin
  destination      The destination path, prefixed with <name:> for a path
                   inside the instance, or '-' for stdout
```

## `umount`

```text
Usage: multipass umount [options] <mount> [<mount> ...]
Unmount a directory from an instance.

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.

Arguments:
  mount          Mount points, in <name>[:<path>] format, where <name> are
                 instance names, and optional <path> are mount points. If
                 omitted, all mounts will be removed from the named instances.
```

## `unalias`

```text
Usage: multipass unalias [options] <name> [<name> ...]
Remove aliases

Options:
  -h, --help     Displays help on commandline options
  -v, --verbose  Increase logging verbosity. Repeat the 'v' in the short option
                 for more detail. Maximum verbosity is obtained with 4 (or more)
                 v's, i.e. -vvvv.
  --all          Remove all aliases from current context

Arguments:
  name           Names of aliases to remove
```

## `version`

```text
Usage: multipass version [options]
Display version information about the multipass command
and daemon.

Options:
  -h, --help         Displays help on commandline options
  -v, --verbose      Increase logging verbosity. Repeat the 'v' in the short
                     option for more detail. Maximum verbosity is obtained with
                     4 (or more) v's, i.e. -vvvv.
  --format <format>  Output version information in the requested format.
                     Valid formats are: table (default), json, csv and yaml
```

