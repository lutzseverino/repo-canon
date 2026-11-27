# Credits

This skill is Repo Canon's own: it was written for Repo Canon and has no upstream base.

The merge check reads repository-hold and release-hold labels only from `.scriptorium/config.json`
on the destination default branch, the trusted base, and accepts configuration versions 1, 2 and
3 there. A configuration found only in the legacy `.factory` directory supplies no holds.

The standalone [runtime](runtime/LICENSE) ships Repo Canon's
[MIT License](runtime/LICENSE) and the upstream notices and provenance beside
the unchanged Postern, marked and parse5 bundles.
