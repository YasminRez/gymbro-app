-- bloqueados_entre é só auxiliar (usada por pode_conversar e listar_conexoes, que rodam como dono).
-- Chamada direta pelo app revelaria se duas pessoas quaisquer se bloquearam (RN-015: o bloqueado não é avisado).
revoke execute on function public.bloqueados_entre(uuid, uuid) from authenticated;
