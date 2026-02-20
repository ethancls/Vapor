1. Changer le logo dans la sidebar, laisser le juste le vapor.png en plus gros avec le titre vapor sans contour et couleur de fond. J'ai aussi renommer le vapor.png en vapor.png et il ya aussi le vapor-black.png on pourra l'utiliser dans d'autres interfaces peut etre.
2. Changer le bouton pour ouvrir fermer la sidebar j'aime pas trop la logique, laisse le en dehors de la sidebar et pas dans la sidebar, je trouve que c'est plus intuitif et en haut a droite
3. Le bouton refresh et instance a coter du search ne font toujours pas la meme epaisseur que les autres boutons, il faut les aligner et les faire de la meme taille.
4. Sur le dashboard agrandis un peu la date / heure
5. Pour les animations de chargement, je trouve que c'est un peu trop rapide, ralentis les un peu pour que ce soit plus fluide et moins brusque peut etre des skeletons ? et ajoute une animation de chargement avec le logo vapor pour les chargements plus longs qui fait toute la page, ca peut etre sympa et ca fait un peu de branding
6. Enleve le recent activity du dashboard a droite de resource, mets le en dessous et enleve l'icone devant le titre de la card et améliore l'ui de cette card
7. Niveau api j'ai des {"detail":"Not Found"} mais j'ai le truc multipass running peut etre mettre une page d'erreur plus custom et sympa pour les erreurs 404 et 500 avec des explications
8. Le bouton de theme j'aime pas trop soit tu decoupes en trois avec les icones soit un dropdown avec les trois options, mais la c'est un peu confus je trouve
9. Sur les instances il manque les tailles de disques meme allumés, et quand eteinte on a pas les vCPU et RAM, il faudrait les afficher aussi
10. Je voudrais des templates d'instances qui sont connues comme les EC2 aws avec nano micro small medium large xlarge etc avec les specs qui vont avec, ca peut aider pour les gens qui veulent juste lancer une instance rapidement sans se prendre la tete a choisir les specs et aussi de pouvoir comparer les instances entre elles facilement, aussi avoir la possibilité de sauvegarder une configuration d'instance personnalisée comme template pour la reutiliser facilement après.
11. Ne faudrait t-il pas une base sqlite pour stocker les templates d'instances et les configurations personnalisées ? ca pourrait etre plus facile a gerer que des fichiers json et aussi plus rapide pour les requetes, surtout si on veut faire des recherches ou des filtres sur les templates. Pareil pour les logs d'activités, ca pourrait etre sympa de les stocker dans une base pour pouvoir faire des recherches et des filtres dessus aussi. Et pourquoi pas ensuite stocker les utilisateurs et leurs préférences de theme etc dans la base aussi pour une experience plus personnalisée.
12. Dashboard: ajouter une card Alerts (RAM > 85%, Disk > 90%, VM down, daemon offline) avec niveaux de criticité.
13. Dashboard: ajouter des Quick Actions batch (start/stop/restart) pour plusieurs VMs.
14. Dashboard: ajouter un bloc Cost/Usage estimator (vCPU + RAM + uptime) pour avoir une estimation simple.
15. Dashboard: ajouter un bloc Recent failures dédié (actions en erreur depuis activity).
16. Dashboard: ajouter des Template shortcuts (small/medium/large) pour lancement rapide.
17. Dashboard: ajouter un Capacity summary (configured vs used CPU/RAM/Disk + saturation).
18. Dashboard: ajouter un bloc Top consumers (Top 3 RAM/Disk avec mini tendances).
19. Dashboard: ajouter une Health strip (API, websocket clients, poll delay, daemon multipass).
