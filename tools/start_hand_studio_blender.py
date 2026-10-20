"""Start the installed local MCP bridge in an explicitly user-visible Blender."""
import addon_utils
import bpy

addon_utils.enable('blender_mcp', default_set=False, persistent=False)
if not getattr(bpy.types, 'blendermcp_server', None):
    bpy.ops.blendermcp.start_server()
print('Hand Studio: Blender MCP ready')
